import { useEffect, useMemo, useState } from 'react';
import {
  ActionIcon,
  Alert,
  Badge,
  Card,
  Center,
  Group,
  Loader,
  Paper,
  Progress,
  ScrollArea,
  SimpleGrid,
  Stack,
  Table,
  Text,
  Title,
  Tooltip,
  useMantineColorScheme
} from '@mantine/core';
import { IconEye, IconEyeOff, IconMoonStars, IconRefresh, IconSun } from '@tabler/icons-react';
import dayjs from 'dayjs';
import { TransactionTable } from './components/TransactionTable';
import { formatCurrency, formatSignedCurrency } from 'lib/format';
import type { AnalysisSummary, EnrichedTransaction } from 'lib/types';

const fetchFromStorage = async () => {
  return new Promise<{
    transactionsData?: EnrichedTransaction[];
    analysisSummary?: AnalysisSummary;
    analysisGeneratedAt?: number;
    analysisReport?: string;
  }>((resolve) => {
    chrome.storage.local.get(
      ['transactionsData', 'analysisSummary', 'analysisGeneratedAt', 'analysisReport'],
      (result) => resolve(result)
    );
  });
};

const AnalysisApp = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [records, setRecords] = useState<EnrichedTransaction[]>([]);
  const [summary, setSummary] = useState<AnalysisSummary | null>(null);
  const [generatedAt, setGeneratedAt] = useState<number | null>(null);
  const [showOverview, setShowOverview] = useState(true);

  const refresh = async () => {
    setLoading(true);
    const { transactionsData, analysisSummary, analysisGeneratedAt } = await fetchFromStorage();

    if (!transactionsData || !analysisSummary) {
      setError('未找到分析记录，请先在弹窗中运行一次账单分析。');
      setRecords([]);
      setSummary(null);
      setGeneratedAt(null);
      setLoading(false);
      return;
    }

    setRecords(transactionsData);
    setSummary(analysisSummary);
    setGeneratedAt(analysisGeneratedAt ?? null);
    setError(null);
    setLoading(false);
  };

  useEffect(() => {
    refresh();

    const handleStorageChange = (
      changes: { [key: string]: chrome.storage.StorageChange },
      areaName: string
    ) => {
      if (areaName === 'local' && (changes.transactionsData || changes.analysisSummary)) {
        refresh();
      }
    };

    chrome.storage.onChanged.addListener(handleStorageChange);
    return () => chrome.storage.onChanged.removeListener(handleStorageChange);
  }, []);

  const categoryEntries = useMemo(() => {
    if (!summary) return [];
    return Object.entries(summary.categorySummary)
      .sort(([, amountA], [, amountB]) => amountB - amountA)
      .map(([category, amount]) => {
        const ratio = summary.totalExpense > 0 ? (amount / summary.totalExpense) * 100 : 0;
        return { category, amount, ratio };
      });
  }, [summary]);

  const lastUpdated = useMemo(() => {
    if (!generatedAt) return '—';
    return dayjs(generatedAt).format('YYYY-MM-DD HH:mm:ss');
  }, [generatedAt]);

  if (loading) {
    return (
      <Center h="100vh">
        <Loader size="lg" />
      </Center>
    );
  }

  if (error) {
    return (
      <Stack p="xl" gap="lg">
        <Alert color="red" title="暂无分析数据">
          {error}
        </Alert>
        <Text size="sm" c="dimmed">
          返回邮箱页面，打开扩展弹窗并点击“开始分析”后再回来查看详细结果。
        </Text>
      </Stack>
    );
  }

  if (!summary) {
    return null;
  }

  return (
    <Stack p="xl" gap="md">
      <HeaderBar
        lastUpdated={lastUpdated}
        onRefresh={refresh}
        showOverview={showOverview}
        onToggleOverview={() => setShowOverview((value) => !value)}
      />

      {showOverview && (
        <>
          <SimpleGrid cols={{ base: 1, sm: 2, md: 3, lg: 6 }} spacing="lg">
            <StatCard label="交易笔数" value={`${summary.totalTransactions} 笔`} />
            <StatCard label="总支出" value={formatCurrency(summary.totalExpense)} accent="green" />
            <StatCard label="总收入" value={formatCurrency(summary.totalIncome)} accent="red" />
            <StatCard label="净支出" value={formatSignedCurrency(summary.netExpense)} />
            <StatCard label="还款金额" value={formatCurrency(summary.repaymentAmount)} />
            <StatCard label="退款金额" value={formatCurrency(summary.refundAmount)} />
          </SimpleGrid>

          <Card withBorder radius="lg" padding="lg">
            <Stack gap="sm">
              <div>
                <Text fw={600}>分类统计</Text>
                <Text size="xs" c="dimmed">
                  自动根据商户关键字归类，可在 `src/lib/data/categories.json` 中维护。
                </Text>
              </div>
              {categoryEntries.length === 0 ? (
                <Text c="dimmed" size="sm">
                  暂无分类数据。
                </Text>
              ) : (
                <ScrollArea h={220} type="hover">
                  <Table horizontalSpacing="md" verticalSpacing="sm" highlightOnHover>
                    <Table.Thead>
                      <Table.Tr>
                        <Table.Th>分类</Table.Th>
                        <Table.Th ta="right">金额</Table.Th>
                        <Table.Th style={{ width: 200 }}>占比</Table.Th>
                      </Table.Tr>
                    </Table.Thead>
                    <Table.Tbody>
                      {categoryEntries.map((entry, index) => (
                        <Table.Tr key={entry.category}>
                          <Table.Td>
                            <Group gap="xs">
                              <Badge
                                radius="sm"
                                variant={index === 0 ? 'filled' : 'light'}
                                color={index === 0 ? 'blue' : 'gray'}
                              >
                                {index + 1}
                              </Badge>
                              <Text fw={600}>{entry.category}</Text>
                            </Group>
                          </Table.Td>
                          <Table.Td ta="right">
                            <Text fw={600}>{formatCurrency(entry.amount)}</Text>
                          </Table.Td>
                          <Table.Td>
                            <Stack gap={6}>
                              <Progress value={Math.min(100, entry.ratio)} color="blue" size="xs" radius="xl" />
                              <Text size="xs" ta="right" fw={500} c="dimmed">
                                {entry.ratio.toFixed(1)}%
                              </Text>
                            </Stack>
                          </Table.Td>
                        </Table.Tr>
                      ))}
                    </Table.Tbody>
                  </Table>
                </ScrollArea>
              )}
            </Stack>
          </Card>
        </>
      )}

      <Card withBorder radius="lg" padding="lg">
        <Stack gap="sm">
          <Group justify="space-between" align="flex-end">
            <div>
              <Text fw={600}>交易明细</Text>
              <Text size="xs" c="dimmed">
                支持按分类、收支方向、关键字组合筛选，并可按任意列排序。
              </Text>
            </div>
            <Badge variant="light" color="gray">
              最近更新：{lastUpdated}
            </Badge>
          </Group>
          <TransactionTable records={records} />
        </Stack>
      </Card>
    </Stack>
  );
};

const StatCard = ({
  label,
  value,
  accent
}: {
  label: string;
  value: string;
  accent?: 'red' | 'green' | undefined;
}) => (
  <Paper withBorder radius="md" p="lg">
    <Stack gap={6}>
      <Text size="sm" c="dimmed">
        {label}
      </Text>
      <Text fw={700} c={accent}>
        {value}
      </Text>
    </Stack>
  </Paper>
);

const RefreshButton = ({ onRefresh }: { onRefresh: () => void }) => (
  <Tooltip label="重新从本地存储读取最新分析数据">
    <ActionIcon variant="light" onClick={onRefresh}>
      <IconRefresh size={16} />
    </ActionIcon>
  </Tooltip>
);

const HeaderBar = ({
  lastUpdated,
  onRefresh,
  showOverview,
  onToggleOverview
}: {
  lastUpdated: string;
  onRefresh: () => void;
  showOverview: boolean;
  onToggleOverview: () => void;
}) => {
  const { colorScheme, toggleColorScheme } = useMantineColorScheme();
  const isDark = colorScheme === 'dark';

  return (
    <Group justify="space-between">
      <Stack gap={4}>
        <Title order={2}>信用卡账单智能分析</Title>
        <Text size="sm" c="dimmed">
          使用 Mantine Table 展示详细账目，支持筛选与排序。
        </Text>
      </Stack>
      <Group gap="sm">
        <Badge variant="light">最后更新：{lastUpdated}</Badge>
        <Tooltip label={showOverview ? '隐藏统计概览' : '显示统计概览'}>
          <ActionIcon variant="light" onClick={onToggleOverview} aria-label="切换统计概览">
            {showOverview ? <IconEyeOff size={18} /> : <IconEye size={18} />}
          </ActionIcon>
        </Tooltip>
        <RefreshButton onRefresh={onRefresh} />
        <Tooltip label="切换主题">
          <ActionIcon
            variant="light"
            onClick={() => toggleColorScheme()}
            aria-label="切换主题"
          >
            {isDark ? <IconSun size={18} /> : <IconMoonStars size={18} />}
          </ActionIcon>
        </Tooltip>
      </Group>
    </Group>
  );
};

export default AnalysisApp;
