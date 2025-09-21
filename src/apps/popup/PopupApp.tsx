import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Box,
  Button,
  Group,
  Loader,
  MantineProvider,
  Paper,
  SimpleGrid,
  Stack,
  Text,
  Title,
  Tooltip
} from '@mantine/core';
import { IconArrowRight, IconClipboard, IconDownload, IconTable } from '@tabler/icons-react';
import { downloadFile, formatCurrency, formatSignedCurrency, toCsv } from 'lib/format';
import type { AnalysisResult, EnrichedTransaction } from 'lib/types';

type AnalyzeStatus = 'idle' | 'loading' | 'success' | 'error';

type MessageState = {
  tone: 'info' | 'success' | 'error';
  content: string;
};

interface RawTransaction {
  transactionDate: string;
  merchant: string;
  amount: number;
}

const defaultMessage: MessageState = {
  tone: 'info',
  content: '准备就绪，点击下方按钮开始分析当前页面的账单数据。'
};

const SummaryMetric = ({ label, value }: { label: string; value: string }) => (
  <Paper radius="sm" withBorder p="sm">
    <Stack gap={4}>
      <Text size="xs" c="dimmed">
        {label}
      </Text>
      <Text fw={600}>{value}</Text>
    </Stack>
  </Paper>
);

function extractBillDataFromPage(): RawTransaction[] {
  const expenseKeywords = ['支出', '消费', '扣款', '付款'];
  const incomeKeywords = ['存入', '收入', '退款', '退货', '还款', '转账'];

  const parseNumericAmount = (text: string | null): number | null => {
    if (!text) return null;
    const amountMatch = text.match(/(-?[\d,]+\.\d{2})/);
    if (!amountMatch) return null;
    return parseFloat(amountMatch[0].replace(/,/g, ''));
  };

  const detectDirection = (text: string | null): 'expense' | 'income' | null => {
    if (!text) return null;
    const normalized = text.toLowerCase();
    if (expenseKeywords.some((keyword) => normalized.includes(keyword))) {
      return 'expense';
    }
    if (incomeKeywords.some((keyword) => normalized.includes(keyword))) {
      return 'income';
    }
    return null;
  };

  const rows = Array.from(document.querySelectorAll('tr'));
  const transactions: RawTransaction[] = [];

  rows.forEach((row) => {
    const cells = Array.from(row.querySelectorAll('td, th')).map((cell) => cell.textContent?.trim() ?? '');
    const rowText = row.textContent?.toLowerCase() ?? '';

    if (rowText.includes('交易日') || rowText.includes('商户名称') || rowText.includes('合计')) {
      return;
    }

    const dateRegex = /\d{4}-\d{2}-\d{2}/;
    const amountRegex = /[\d,]+\.\d{2}\/?RMB?(?:\((支出|存入|收入|退款|还款)\))?/i;

    let date: string | null = null;
    let amountText: string | null = null;
    let directionHint: 'expense' | 'income' | null = null;

    for (const cell of cells) {
      if (!date && dateRegex.test(cell)) {
        const match = cell.match(dateRegex);
        date = match ? match[0] : null;
      }

      if (!amountText && amountRegex.test(cell)) {
        amountText = cell;
      }

      if (!directionHint) {
        const normalized = cell.toLowerCase();
        if (expenseKeywords.some((keyword) => normalized.includes(keyword))) {
          directionHint = 'expense';
          continue;
        }
        if (incomeKeywords.some((keyword) => normalized.includes(keyword))) {
          directionHint = 'income';
        }
      }
    }

    if (!date || !amountText) {
      return;
    }

    const baseAmount = parseNumericAmount(amountText);
    if (baseAmount === null) {
      return;
    }

    let direction = directionHint ?? detectDirection(amountText) ?? detectDirection(rowText);
    if (!direction) {
      direction = baseAmount >= 0 ? 'income' : 'expense';
    }

    let amount = Math.abs(baseAmount);
    amount = direction === 'expense' ? -amount : amount;

    const merchantCandidates = cells.filter(
      (cell) => !dateRegex.test(cell) && !amountRegex.test(cell) && !/^\d{4}$/.test(cell)
    );
    const merchant = merchantCandidates.join(' ').trim() || '未知商户';

    transactions.push({
      transactionDate: date,
      merchant,
      amount
    });
  });

  return transactions;
}

const PopupApp = () => {
  const [status, setStatus] = useState<AnalyzeStatus>('idle');
  const [message, setMessage] = useState<MessageState>(defaultMessage);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  useEffect(() => {
    if (status === 'idle') {
      setMessage(defaultMessage);
    }
  }, [status]);

  const handleAnalyze = async () => {
    setStatus('loading');
    setMessage({ tone: 'info', content: '正在提取页面中的账单交易数据…' });

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('无法获取当前标签页。');
      }

      const injectionResult = await chrome.scripting.executeScript<[], RawTransaction[]>({
        target: { tabId: tab.id },
        func: extractBillDataFromPage
      });

      const [frameResult] = injectionResult;
      const transactions: RawTransaction[] = frameResult?.result ?? [];

      if (!transactions.length) {
        setStatus('error');
        setMessage({ tone: 'error', content: '未检测到账单交易数据，请确认当前页面为信用卡账单。' });
        return;
      }

      setMessage({ tone: 'info', content: `已提取 ${transactions.length} 条交易，正在调用后台分析…` });

      const analysisResponse = await new Promise<{ result?: AnalysisResult; error?: string }>((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'ANALYZE_BILL', data: transactions }, (response) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
            return;
          }
          resolve(response ?? {});
        });
      });

      if (analysisResponse.error || !analysisResponse.result) {
        throw new Error(analysisResponse.error || '后台分析失败');
      }

      const analysisResult = analysisResponse.result;
      setResult(analysisResult);

      await chrome.storage.local.set({
        transactionsData: analysisResult.records,
        analysisSummary: analysisResult.summary,
        analysisGeneratedAt: Date.now(),
        analysisReport: analysisResult.report
      });

      setStatus('success');
      setMessage({ tone: 'success', content: `分析完成，共识别 ${analysisResult.records.length} 条交易。` });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '分析过程中出现错误';
      setStatus('error');
      setMessage({ tone: 'error', content: `❌ ${errorMessage}` });
    }
  };

  const handleOpenAnalysis = async () => {
    await chrome.tabs.create({ url: chrome.runtime.getURL('analysis/index.html') });
  };

  const handleExportCsv = () => {
    if (!result) {
      return;
    }

    const csvContent = toCsv(result.records);
    downloadFile(
      csvContent,
      `credit-card-analysis-${new Date().toISOString().split('T')[0]}.csv`,
      'text/csv'
    );
  };

  const handleCopyReport = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.report);
      setMessage({ tone: 'success', content: '分析报告已复制到剪贴板。' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '复制失败，请手动复制内容。';
      setMessage({ tone: 'error', content: `📋 ${errorMessage}` });
    }
  };

  const summaryStats = useMemo(() => {
    if (!result) {
      return null;
    }

    const {
      totalTransactions,
      totalExpense,
      totalIncome,
      refundAmount,
      repaymentAmount,
      netExpense
    } = result.summary;

    return {
      totalTransactions,
      totalExpense,
      totalIncome,
      refundAmount,
      repaymentAmount,
      netExpense
    };
  }, [result]);

  const topExpenses = useMemo(() => result?.topExpenses ?? [], [result]);

  return (
    <MantineProvider defaultColorScheme="auto">
      <Box p="md" w={360} maw="100vw">
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={3}>信用卡账单智能分析</Title>
            <Text size="sm" c="dimmed">
              自动提取当前页面的账单数据，生成分类统计与明细表格。
            </Text>
          </Stack>

          <Button
            onClick={handleAnalyze}
            loading={status === 'loading'}
            loaderProps={{ type: 'dots' }}
            fullWidth
          >
            开始分析当前页面账单
          </Button>

          {status !== 'idle' && (
            <Alert
              variant="light"
              color={message.tone === 'error' ? 'red' : message.tone === 'success' ? 'green' : 'blue'}
              title={
                message.tone === 'error'
                  ? '分析失败'
                  : message.tone === 'success'
                  ? '分析完成'
                  : '提示信息'
              }
            >
              {message.content}
            </Alert>
          )}

          <Stack gap="xs">
            <Group gap="sm" justify="space-between">
              <Text size="sm" fw={600}>
                分析操作
              </Text>
              <Group gap="xs">
                <Tooltip label="导出交易记录为 CSV">
                  <ActionIcon
                    variant="subtle"
                    onClick={handleExportCsv}
                    disabled={!result || status !== 'success'}
                  >
                    <IconDownload size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="复制分析报告到剪贴板">
                  <ActionIcon
                    variant="subtle"
                    onClick={handleCopyReport}
                    disabled={!result || status !== 'success'}
                  >
                    <IconClipboard size={16} />
                  </ActionIcon>
                </Tooltip>
                <Tooltip label="跳转到详细分析页面">
                  <ActionIcon variant="subtle" onClick={handleOpenAnalysis}>
                    <IconTable size={16} />
                  </ActionIcon>
                </Tooltip>
              </Group>
            </Group>

            {!result ? (
              <Paper withBorder radius="sm" p="md">
                <Stack gap="xs" align="center">
                  {status === 'loading' ? (
                    <Loader size="sm" />
                  ) : (
                    <IconArrowRight size={18} color="var(--mantine-color-blue-6)" />
                  )}
                  <Text size="xs" c="dimmed" ta="center">
                    点击“开始分析当前页面账单”将自动提取页面中的交易表格并完成分类汇总。
                  </Text>
                </Stack>
              </Paper>
            ) : (
              <Paper withBorder radius="sm" p="md">
                <Stack gap="xs">
                  <Text size="xs" c="dimmed">
                    已完成分析，可导出 CSV 或复制摘要。
                  </Text>
                  <Group justify="space-between" gap="xs">
                    <Tooltip label="导出交易记录为 CSV">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconDownload size={14} />}
                        onClick={handleExportCsv}
                      >
                        导出 CSV
                      </Button>
                    </Tooltip>
                    <Tooltip label="复制分析报告到剪贴板">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconClipboard size={14} />}
                        onClick={handleCopyReport}
                      >
                        复制报告
                      </Button>
                    </Tooltip>
                    <Tooltip label="在新标签页中查看分析页面">
                      <Button
                        variant="light"
                        size="xs"
                        leftSection={<IconTable size={14} />}
                        onClick={handleOpenAnalysis}
                      >
                        详细分析
                      </Button>
                    </Tooltip>
                  </Group>
                </Stack>
              </Paper>
            )}
          </Stack>

          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between" align="flex-end">
                <Text size="sm" fw={600}>
                  快速概览
                </Text>
                <Badge variant="light" color={status === 'success' ? 'green' : 'gray'}>
                  {status === 'success' ? '分析完成' : '待分析'}
                </Badge>
              </Group>

              <SimpleGrid cols={2} spacing="xs" verticalSpacing="xs">
                <SummaryMetric label="交易笔数" value={summaryStats ? `${summaryStats.totalTransactions} 笔` : '--'} />
                <SummaryMetric
                  label="总支出"
                  value={summaryStats ? formatCurrency(summaryStats.totalExpense) : '--'}
                />
                <SummaryMetric
                  label="总收入"
                  value={summaryStats ? formatCurrency(summaryStats.totalIncome) : '--'}
                />
                <SummaryMetric
                  label="净支出"
                  value={summaryStats ? formatSignedCurrency(summaryStats.netExpense) : '--'}
                />
                <SummaryMetric
                  label="退款收入"
                  value={summaryStats ? formatCurrency(summaryStats.refundAmount) : '--'}
                />
                <SummaryMetric
                  label="本月还款"
                  value={summaryStats ? formatCurrency(summaryStats.repaymentAmount) : '--'}
                />
              </SimpleGrid>
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <Text size="sm" fw={600}>
                  最大单笔消费
                </Text>
                <Badge variant="light" color="blue">
                  Top {Math.min(5, topExpenses.length)}
                </Badge>
              </Group>

              {!result ? (
                <Text size="xs" c="dimmed">
                  分析完成后会展示识别出的最大单笔消费记录。
                </Text>
              ) : topExpenses.length === 0 ? (
                <Text size="xs" c="dimmed">
                  暂无消费记录，可能全部为退款或还款。
                </Text>
              ) : (
                <Stack gap="xs">
                  {topExpenses.map((transaction) => (
                    <Paper key={`${transaction.transactionDate}-${transaction.merchant}-${transaction.amount}`} radius="sm" p="sm" withBorder>
                      <Stack gap={4}>
                        <Group justify="space-between">
                          <Text fw={600}>{transaction.merchant}</Text>
                          <Text fw={600} c="green">
                            {formatCurrency(Math.abs(transaction.amount))}
                          </Text>
                        </Group>
                        <Group gap="xs">
                          <Badge variant="light" color="blue" size="xs">
                            {transaction.category}
                          </Badge>
                          <Badge variant="light" size="xs">
                            {transaction.transactionDate}
                          </Badge>
                        </Group>
                      </Stack>
                    </Paper>
                  ))}
                </Stack>
              )}
            </Stack>
          </Paper>

          <Paper withBorder radius="md" p="md">
            <Group justify="space-between" align="flex-start">
              <Stack gap={0}>
                <Text size="sm" fw={600}>
                  分析历史
                </Text>
                <Text size="xs" c="dimmed">
                  最新分析结果会缓存供详细页面使用。
                </Text>
              </Stack>
              <Tooltip label="在新标签页中查看分析页面">
                <ActionIcon variant="subtle" onClick={handleOpenAnalysis}>
                  <IconArrowRight size={16} />
                </ActionIcon>
              </Tooltip>
            </Group>
          </Paper>
        </Stack>
      </Box>
    </MantineProvider>
  );
};

export default PopupApp;
