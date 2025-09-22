import categoriesData from 'lib/data/categories.json';
import { formatCurrency } from 'lib/format';
import type {
  AnalysisResult,
  AnalysisSummary,
  EnrichedTransaction,
  IncomeType,
  Transaction
} from 'lib/types';

type CategoryDictionary = Record<string, string[]>;

const categories: CategoryDictionary = categoriesData as CategoryDictionary;
const repaymentKeywords = ['还款', '转账', '手机银行'];

export class BillAnalyzer {
  private readonly categories: CategoryDictionary;

  constructor() {
    this.categories = categories;
  }

  private classify(merchant: string): string {
    if (!merchant) {
      return '其他';
    }

    const normalizedMerchant = merchant.toLowerCase();

    for (const [category, keywords] of Object.entries(this.categories)) {
      for (const keyword of keywords) {
        if (normalizedMerchant.includes(keyword.toLowerCase())) {
          return category;
        }
      }
    }

    return '其他';
  }

  analyze(transactions: Transaction[]): AnalysisResult {
    const records: EnrichedTransaction[] = transactions.map((transaction) => {
      const amount = Number(transaction.amount);
      const flow = amount >= 0 ? 'income' : 'expense';
      const merchant = transaction.merchant || '未知商户';
      let incomeType: IncomeType | null = null;

      if (flow === 'income') {
        const normalizedMerchant = merchant.toLowerCase();
        const isRepayment = repaymentKeywords.some((keyword) =>
          normalizedMerchant.includes(keyword.toLowerCase())
        );
        incomeType = isRepayment ? 'repayment' : 'refund';
      }

      return {
        transactionDate: transaction.transactionDate,
        merchant,
        amount,
        category: this.classify(transaction.merchant),
        flow,
        incomeType
      };
    });

    let totalExpense = 0;
    let totalIncome = 0;
    let repaymentAmount = 0;
    let refundAmount = 0;
    const categorySummary: AnalysisSummary['categorySummary'] = {};

    records.forEach((record) => {
      if (record.flow === 'expense') {
        const expense = Math.abs(record.amount);
        totalExpense += expense;
        categorySummary[record.category] = (categorySummary[record.category] || 0) + expense;
      } else {
        totalIncome += record.amount;
        if (record.incomeType === 'repayment') {
          repaymentAmount += record.amount;
        } else {
          refundAmount += record.amount;
        }
      }
    });

    const netExpense = totalExpense - refundAmount;

    const topExpenses = records
      .filter((record) => record.flow === 'expense')
      .slice()
      .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount))
      .slice(0, 5);

    const reportSections = [
      '--- 账单分析报告 ---',
      `总交易笔数: ${records.length} 笔`,
      `总支出: ${formatCurrency(totalExpense)}`,
      `总收入: ${formatCurrency(totalIncome)}`,
      `上月还款金额: ${formatCurrency(repaymentAmount)}`,
      `本月退款金额: ${formatCurrency(refundAmount)}`,
      `本月净支出: ${formatCurrency(netExpense)}`,
      '',
      '--- 消费分类统计 ---'
    ];

    Object.entries(categorySummary)
      .sort(([, amountA], [, amountB]) => amountB - amountA)
      .forEach(([category, amount]) => {
        const ratio = totalExpense > 0 ? ((amount / totalExpense) * 100).toFixed(1) : '0.0';
        reportSections.push(`${category}: ${formatCurrency(amount)} (${ratio}%)`);
      });

    reportSections.push('', '--- 最大单笔消费 Top 5 ---');
    topExpenses.forEach((record, index) => {
      reportSections.push(
        `${index + 1}. ${record.transactionDate} | ${record.merchant} | ${formatCurrency(Math.abs(record.amount))}`
      );
    });

    const summary: AnalysisSummary = {
      totalTransactions: records.length,
      totalExpense,
      totalIncome,
      repaymentAmount,
      refundAmount,
      netExpense,
      categorySummary
    };

    return {
      records,
      summary,
      topExpenses,
      report: reportSections.join('\n')
    };
  }
}
