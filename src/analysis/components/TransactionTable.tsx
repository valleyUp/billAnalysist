import { useMemo, useState } from 'react';
import {
  ActionIcon,
  Badge,
  Group,
  MultiSelect,
  ScrollArea,
  SegmentedControl,
  Stack,
  Table,
  Text,
  TextInput,
  Tooltip
} from '@mantine/core';
import {
  IconArrowDown,
  IconArrowUp,
  IconArrowsSort,
  IconSearch,
  IconX
} from '@tabler/icons-react';
import { formatCurrency, formatDate } from '../../shared/format';
import type { EnrichedTransaction } from '../../shared/types';

type SortKey = 'transactionDate' | 'merchant' | 'amount' | 'category';

type SortState = {
  key: SortKey;
  direction: 'asc' | 'desc';
};

interface TransactionTableProps {
  records: EnrichedTransaction[];
}

const defaultSort: SortState = { key: 'transactionDate', direction: 'desc' };

export const TransactionTable = ({ records }: TransactionTableProps) => {
  const [search, setSearch] = useState('');
  const [flowFilter, setFlowFilter] = useState<'all' | 'expense' | 'income'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string[]>([]);
  const [sort, setSort] = useState<SortState>(defaultSort);

  const categories = useMemo(() => {
    const set = new Set<string>();
    records.forEach((record) => set.add(record.category));
    return Array.from(set).sort();
  }, [records]);

  const filtered = useMemo(() => {
    return records.filter((record) => {
      const matchesSearch = search
        ? record.merchant.toLowerCase().includes(search.toLowerCase()) ||
          record.category.toLowerCase().includes(search.toLowerCase())
        : true;
      const matchesFlow =
        flowFilter === 'all' ? true : record.flow === flowFilter;
      const matchesCategory =
        categoryFilter.length === 0 || categoryFilter.includes(record.category);

      return matchesSearch && matchesFlow && matchesCategory;
    });
  }, [records, search, flowFilter, categoryFilter]);

  const sortedRecords = useMemo(() => {
    const sorted = [...filtered];
    sorted.sort((a, b) => {
      let comparison = 0;
      switch (sort.key) {
        case 'transactionDate':
          comparison = a.transactionDate.localeCompare(b.transactionDate);
          break;
        case 'merchant':
          comparison = a.merchant.localeCompare(b.merchant);
          break;
        case 'category':
          comparison = a.category.localeCompare(b.category);
          break;
        case 'amount':
          comparison = a.amount - b.amount;
          break;
        default:
          comparison = 0;
      }

      return sort.direction === 'asc' ? comparison : -comparison;
    });
    return sorted;
  }, [filtered, sort]);

  const filteredTotals = useMemo(() => {
    return filtered.reduce(
      (acc, transaction) => {
        if (transaction.flow === 'expense') {
          acc.expense += Math.abs(transaction.amount);
        } else {
          acc.income += transaction.amount;
        }
        return acc;
      },
      { expense: 0, income: 0 }
    );
  }, [filtered]);

  const toggleSort = (key: SortKey) => {
    setSort((current) => {
      if (current.key === key) {
        const direction = current.direction === 'asc' ? 'desc' : 'asc';
        return { key, direction };
      }
      return { key, direction: key === 'merchant' ? 'asc' : 'desc' };
    });
  };

  const clearFilters = () => {
    setSearch('');
    setFlowFilter('all');
    setCategoryFilter([]);
    setSort(defaultSort);
  };

  const renderSortIcon = (key: SortKey) => {
    if (sort.key !== key) {
      return <IconArrowsSort size={14} />;
    }
    return sort.direction === 'asc' ? <IconArrowUp size={14} /> : <IconArrowDown size={14} />;
  };

  return (
    <Stack gap="sm">
      <Group align="flex-end" gap="sm" wrap="wrap">
        <TextInput
          label="搜索"
          placeholder="按商户或分类搜索"
          leftSection={<IconSearch size={14} />}
          value={search}
          onChange={(event) => setSearch(event.currentTarget.value)}
          w={220}
        />
        <MultiSelect
          label="分类筛选"
          placeholder="选择一个或多个分类"
          value={categoryFilter}
          data={categories.map((category) => ({ label: category, value: category }))}
          searchable
          clearable
          w={220}
          onChange={setCategoryFilter}
          nothingFoundMessage="没有匹配的分类"
        />
        <SegmentedControl
          data={[
            { label: '全部', value: 'all' },
            { label: '支出', value: 'expense' },
            { label: '收入', value: 'income' }
          ]}
          value={flowFilter}
          onChange={(value: 'all' | 'expense' | 'income') => setFlowFilter(value)}
        />
        <Tooltip label="重置筛选与排序">
          <ActionIcon variant="light" onClick={clearFilters} aria-label="重置筛选">
            <IconX size={16} />
          </ActionIcon>
        </Tooltip>
      </Group>

      <Text size="xs" c="dimmed">
        显示 {sortedRecords.length} / {records.length} 条 | 支出 {formatCurrency(filteredTotals.expense)} · 收入 {formatCurrency(filteredTotals.income)}
      </Text>

      <ScrollArea h={420} type="hover">
        <Table highlightOnHover stickyHeader>
          <Table.Thead>
            <Table.Tr>
              <Table.Th onClick={() => toggleSort('transactionDate')} style={{ cursor: 'pointer' }}>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={600}>
                    交易日期
                  </Text>
                  {renderSortIcon('transactionDate')}
                </Group>
              </Table.Th>
              <Table.Th onClick={() => toggleSort('merchant')} style={{ cursor: 'pointer' }}>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={600}>
                    商户
                  </Text>
                  {renderSortIcon('merchant')}
                </Group>
              </Table.Th>
              <Table.Th onClick={() => toggleSort('category')} style={{ cursor: 'pointer' }}>
                <Group gap={4} wrap="nowrap">
                  <Text size="sm" fw={600}>
                    分类
                  </Text>
                  {renderSortIcon('category')}
                </Group>
              </Table.Th>
              <Table.Th onClick={() => toggleSort('amount')} style={{ cursor: 'pointer' }}>
                <Group gap={4} wrap="nowrap" justify="flex-end">
                  <Text size="sm" fw={600}>
                    金额
                  </Text>
                  {renderSortIcon('amount')}
                </Group>
              </Table.Th>
            </Table.Tr>
          </Table.Thead>
          <Table.Tbody>
            {sortedRecords.length === 0 ? (
              <Table.Tr>
                <Table.Td colSpan={4}>
                  <Text ta="center" c="dimmed">
                    当前筛选条件下没有交易记录。
                  </Text>
                </Table.Td>
              </Table.Tr>
            ) : (
              sortedRecords.map((transaction, index) => (
                <Table.Tr key={`${transaction.transactionDate}-${transaction.merchant}-${transaction.amount}-${index}`}>
                  <Table.Td>
                    <Text size="sm" fw={500}>
                      {formatDate(transaction.transactionDate)}
                    </Text>
                  </Table.Td>
                  <Table.Td>
                    <Stack gap={2}>
                      <Text size="sm" fw={600}>
                        {transaction.merchant}
                      </Text>
                      <Badge
                        color={transaction.flow === 'expense' ? 'green' : 'red'}
                        variant="light"
                        radius="sm"
                        w="fit-content"
                      >
                        {transaction.flow === 'expense' ? '支出' : '收入'}
                      </Badge>
                    </Stack>
                  </Table.Td>
                  <Table.Td>
                    <Badge variant="outline" radius="sm">
                      {transaction.category}
                    </Badge>
                  </Table.Td>
                  <Table.Td ta="right">
                    <Text fw={600} c={transaction.flow === 'expense' ? 'green' : 'red'}>
                      {formatCurrency(Math.abs(transaction.amount))}
                    </Text>
                  </Table.Td>
                </Table.Tr>
              ))
            )}
          </Table.Tbody>
        </Table>
      </ScrollArea>
    </Stack>
  );
};
