export interface Transaction {
  transactionDate: string;
  merchant: string;
  amount: number;
}

export type CashFlow = 'income' | 'expense';

export interface EnrichedTransaction extends Transaction {
  category: string;
  flow: CashFlow;
}

export interface CategorySummary {
  [category: string]: number;
}

export interface AnalysisSummary {
  totalTransactions: number;
  totalExpense: number;
  totalIncome: number;
  repaymentAmount: number;
  refundAmount: number;
  netExpense: number;
  categorySummary: CategorySummary;
}

export interface AnalysisResult {
  records: EnrichedTransaction[];
  summary: AnalysisSummary;
  topExpenses: EnrichedTransaction[];
  report: string;
}

export interface StoredAnalysisPayload {
  transactionsData: EnrichedTransaction[];
  analysisSummary: AnalysisSummary;
  analysisGeneratedAt: number;
}
