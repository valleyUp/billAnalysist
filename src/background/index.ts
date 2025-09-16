import { BillAnalyzer } from '../shared/analyzer';
import type { AnalysisResult, Transaction } from '../shared/types';

const analyzer = new BillAnalyzer();

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'ANALYZE_BILL') {
    const transactions = (message.data || []) as Transaction[];

    (async () => {
      try {
        const result: AnalysisResult = analyzer.analyze(transactions);
        sendResponse({ result });
      } catch (error) {
        const message = error instanceof Error ? error.message : '分析失败';
        sendResponse({ error: message });
      }
    })();

    return true;
  }

  return undefined;
});
