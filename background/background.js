// background.js

class BillAnalyzer {
    constructor() {
        this.categories = null;
    }

    async loadCategories() {
        if (this.categories) {
            return;
        }
        try {
            const response = await fetch(chrome.runtime.getURL('assets/categories.json'));
            if (!response.ok) {
                throw new Error(`无法加载分类文件: ${response.statusText}`);
            }
            this.categories = await response.json();
            console.log('分类信息已成功加载。');
        } catch (error) {
            console.error('加载分类信息时出错:', error);
            // 如果加载失败，则使用一个默认的最小分类
            this.categories = { '其他': [] };
        }
    }

    classify(merchant) {
        if (!this.categories) {
            console.error('分类数据未加载!');
            return '其他';
        }
        merchant = merchant.toLowerCase();
        for (const [category, keywords] of Object.entries(this.categories)) {
            for (const keyword of keywords) {
                if (merchant.includes(keyword.toLowerCase())) {
                    return category;
                }
            }
        }
        return '其他';
    }

    async analyze(transactions) {
        await this.loadCategories();
        
        const df = transactions.map(t => ({
            ...t,
            category: this.classify(t.merchant),
            amount: parseFloat(t.amount)
        }));

        const totalTransactions = df.length;
        const totalExpenses = df.filter(t => t.amount < 0).reduce((sum, t) => sum + Math.abs(t.amount), 0);

        const repaymentKeywords = ['还款', '转账', '手机银行'];
        let repaymentAmount = 0;
        let refundAmount = 0;

        df.filter(t => t.amount > 0).forEach(t => {
            const isRepayment = repaymentKeywords.some(keyword => t.merchant.includes(keyword));
            if (isRepayment) {
                repaymentAmount += t.amount;
            } else {
                refundAmount += t.amount;
            }
        });

        const netExpenseAmount = totalExpenses - refundAmount;

        const categorySummary = {};
        df.filter(t => t.amount < 0).forEach(t => {
            categorySummary[t.category] = (categorySummary[t.category] || 0) + Math.abs(t.amount);
        });

        let report = `--- 账单分析报告 ---
`;
        report += `总交易笔数: ${totalTransactions} 笔
`;
        report += `上月还款金额: ${repaymentAmount.toFixed(2)} 元
`;
        report += `本月退款金额: ${refundAmount.toFixed(2)} 元
`;
        report += `本月净支出: ${netExpenseAmount.toFixed(2)} 元

`;
        
        report += `--- 消费分类统计 ---
`;
        Object.entries(categorySummary)
            .sort(([,a], [,b]) => b - a)
            .forEach(([category, amount]) => {
                const percentage = totalExpenses > 0 ? ((amount / totalExpenses) * 100).toFixed(1) : "0.0";
                report += `${category}: ${amount.toFixed(2)} 元 (${percentage}%)
`;
            });

        const topExpenses = df.filter(t => t.amount < 0)
            .map(t => ({...t, expense_amount: Math.abs(t.amount)}))
            .sort((a, b) => b.expense_amount - a.expense_amount)
            .slice(0, 5);

        report += `
--- 最大单笔消费 Top 5 ---
`;
        topExpenses.forEach((t, i) => {
            report += `${i+1}. ${t.transaction_date} | ${t.merchant} | ${t.expense_amount.toFixed(2)} 元
`;
        });

        return {
            report: report,
            rawData: df,
            summary: {
                totalTransactions: totalTransactions,
                repaymentAmount: repaymentAmount,
                refundAmount: refundAmount,
                netExpenseAmount: netExpenseAmount,
                categorySummary: categorySummary
            }
        };
    }
}

const analyzer = new BillAnalyzer();

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.type === 'ANALYZE_BILL') {
        (async () => {
            try {
                const result = await analyzer.analyze(request.data);
                sendResponse({ result: result });
            } catch (error) {
                sendResponse({ error: error.message });
            }
        })();
    }
    return true; // 保持消息通道开放以进行异步响应
});