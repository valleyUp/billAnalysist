import { useEffect, useMemo, useState } from 'react';
import ReactDOM from 'react-dom/client';
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
import '@mantine/core/styles.css';
import '../styles/global.css';
import { downloadFile, formatCurrency, formatSignedCurrency, toCsv } from '../shared/format';
import type { AnalysisResult, EnrichedTransaction } from '../shared/types';

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

      const injectionResult = await chrome.scripting.executeScript<{ result: RawTransaction[] | null }>({
        target: { tabId: tab.id },
        func: extractBillDataFromPage
      });

      const transactions = injectionResult?.[0]?.result ?? [];

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
    downloadFile(csvContent, `credit-card-analysis-${new Date().toISOString().split('T')[0]}.csv`, 'text/csv');
  };

  const handleCopyReport = async () => {
    if (!result) {
      return;
    }

    try {
      await navigator.clipboard.writeText(result.report);
      setMessage({ tone: 'success', content: '分析摘要已复制到剪贴板。' });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '复制失败';
      setMessage({ tone: 'error', content: `复制失败：${errorMessage}` });
    }
  };

  const topExpenses = useMemo(() => result?.topExpenses ?? [], [result]);

  return (
    <MantineProvider defaultColorScheme="auto">
      <Box p="md" w={360}>
        <Stack gap="md">
          <Stack gap={4}>
            <Title order={3}>账单快速分析</Title>
            <Text size="sm" c="dimmed">
              运行抓取 → 后台分类 → 保存结果，全流程基于 React + Mantine。
            </Text>
          </Stack>

          <Paper radius="md" withBorder p="md">
            <Stack gap="sm">
              <Group justify="space-between">
                <div>
                  <Text fw={600}>一键分析</Text>
                  <Text size="xs" c="dimmed">
                    提取并分析当前邮箱账单页面的数据。
                  </Text>
                </div>
                <Button
                  onClick={handleAnalyze}
                  loading={status === 'loading'}
                  loaderProps={{ type: 'oval' }}
                >
                  开始分析
                </Button>
              </Group>

              <Alert
                color={message.tone === 'error' ? 'red' : message.tone === 'success' ? 'teal' : 'blue'}
                icon={status === 'loading' ? <Loader size="sm" /> : undefined}
              >
                {message.content}
              </Alert>

              {result && (
                <Stack gap="sm">
                  <SimpleGrid cols={2} spacing="sm">
                    <SummaryMetric label="交易笔数" value={`${result.summary.totalTransactions} 笔`} />
                    <SummaryMetric label="总支出" value={formatCurrency(result.summary.totalExpense)} />
                    <SummaryMetric label="总收入" value={formatCurrency(result.summary.totalIncome)} />
                    <SummaryMetric label="净支出" value={formatSignedCurrency(result.summary.netExpense)} />
                  </SimpleGrid>

                  <Group justify="space-between">
                    <Button leftSection={<IconTable size={16} />} variant="light" onClick={handleOpenAnalysis}>
                      查看详细账目
                    </Button>
                    <Group gap="xs">
                      <Tooltip label="导出 CSV">
                        <ActionIcon variant="light" onClick={handleExportCsv}>
                          <IconDownload size={16} />
                        </ActionIcon>
                      </Tooltip>
                      <Tooltip label="复制文本报告">
                        <ActionIcon variant="light" onClick={handleCopyReport}>
                          <IconClipboard size={16} />
                        </ActionIcon>
                      </Tooltip>
                    </Group>
                  </Group>
                </Stack>
              )}
            </Stack>
          </Paper>

          {topExpenses.length > 0 && (
            <Paper radius="md" withBorder p="md">
              <Stack gap="xs">
                <Group justify="space-between">
                  <Text fw={600}>高额支出 Top 5</Text>
                  <Badge color="green" radius="sm">
                    支出
                  </Badge>
                </Group>
                <Stack gap="xs">
                  {topExpenses.map((transaction, index) => (
                    <Group key={`${transaction.merchant}-${transaction.transactionDate}-${index}`} gap="xs" wrap="nowrap" justify="space-between">
                      <Group gap="xs" wrap="nowrap">
                        <Badge variant="light" color="gray" radius="sm" w={32} ta="center">
                          {index + 1}
                        </Badge>
                        <div>
                          <Text size="sm" fw={500} truncate>
                            {transaction.merchant}
                          </Text>
                          <Text size="xs" c="dimmed">
                            {transaction.transactionDate}
                          </Text>
                        </div>
                      </Group>
                      <Text size="sm" fw={600} c="green">
                        {formatCurrency(Math.abs(transaction.amount))}
                      </Text>
                    </Group>
                  ))}
                </Stack>
              </Stack>
            </Paper>
          )}

          <Paper radius="md" withBorder p="md">
            <Group gap="xs" justify="space-between">
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

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(<PopupApp />);
