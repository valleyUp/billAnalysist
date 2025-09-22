import dayjs from 'dayjs';
import type { EnrichedTransaction } from 'lib/types';

const currencyFormatter = new Intl.NumberFormat('zh-CN', {
  style: 'currency',
  currency: 'CNY',
  minimumFractionDigits: 2
});

export const formatCurrency = (value: number): string => {
  return currencyFormatter.format(Math.abs(value)).replace(/^\u00a5/, '¥');
};

export const formatSignedCurrency = (value: number): string => {
  const formatted = formatCurrency(value);
  return value >= 0 ? `+${formatted}` : `-${formatted}`;
};

export const formatDate = (value: string): string => {
  return dayjs(value).format('YYYY年MM月DD日');
};

export const resolveFlowLabel = (record: EnrichedTransaction): string => {
  if (record.flow === 'expense') {
    return '支出';
  }

  const incomeType = record.incomeType ?? 'refund';
  if (incomeType === 'repayment') {
    return '还款';
  }
  if (incomeType === 'refund') {
    return '退款';
  }
  return '收入';
};

export const toCsv = (records: EnrichedTransaction[]): string => {
  const header = ['交易日期', '商户', '分类', '金额方向', '金额'];
  const rows = records.map((record) => [
    record.transactionDate,
    record.merchant.replace(/"/g, '""'),
    record.category,
    resolveFlowLabel(record),
    record.amount.toFixed(2)
  ]);
  const csvLines = [header.join(','), ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))];
  return csvLines.join('\n');
};

export const downloadFile = (content: string, filename: string, mimeType = 'text/plain'): void => {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(url);
};
