document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const reportContent = document.getElementById('reportContent');

    analyzeBtn.addEventListener('click', handleAnalysis);

    async function handleAnalysis() {
        setUIState('loading', '正在分析账单...');
        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const injectionResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractBillDataFromPage,
            });

            const transactions = injectionResult?.[0]?.result ?? [];

            if (transactions.length === 0) {
                setUIState('error', '未找到交易数据，请确保页面是正确的信用卡账单。');
                return;
            }

            const analysisResult = await analyzeTransactions(transactions);
            displayResults(analysisResult);
            setUIState('success', '分析完成！');
        } catch (error) {
            console.error('分析错误:', error);
            setUIState('error', `分析失败: ${error.message}`);
        }
    }

    function extractBillDataFromPage() {
        console.log('启动账单提取程序...');

        function parseAmount(text) {
            if (!text) return null;
            const amountMatch = text.match(/(-?[\d,]+\.\d{2})/);
            if (!amountMatch) return null;

            let amount = parseFloat(amountMatch[0].replace(/,/g, ''));

            if (text.includes('支出')) return -Math.abs(amount);
            if (text.includes('存入') || text.includes('收入') || text.includes('退款')) return Math.abs(amount);

            if (amount > 0) return -Math.abs(amount);
            return amount;
        }

        const transactions = [];
        const rows = document.querySelectorAll('tr');

        rows.forEach(row => {
            const cells = Array.from(row.querySelectorAll('td, th')).map(cell => cell.textContent.trim());
            const rowText = row.textContent.toLowerCase();

            if (rowText.includes('交易日') || rowText.includes('商户名称') || rowText.includes('合计') || rowText.includes('---')) {
                return;
            }

            const dateRegex = /\d{4}-\d{2}-\d{2}/;
            const amountRegex = /[\d,]+\.\d{2}\/RMB\((支出|存入|收入|退款)\)/;

            let date, amountText, merchant;
            let dateIndex = -1, amountIndex = -1, typeIndex = -1;

            cells.forEach((cell, index) => {
                if (dateRegex.test(cell)) {
                    date = cell.match(dateRegex)[0];
                    dateIndex = index;
                }
                if (amountRegex.test(cell)) {
                    amountText = cell;
                    amountIndex = index;
                }
                 if (/消费|跨行消费|退款|转账|缴费/.test(cell)) {
                    typeIndex = index;
                }
            });

            if (date && amountText) {
                const amount = parseAmount(amountText);
                merchant = cells.filter((cell, index) =>
                    !/^\d{4}$/.test(cell) && index !== dateIndex && index !== amountIndex && index !== typeIndex && cell.length > 1
                ).join(' ').trim();

                if (amount !== null) {
                    transactions.push({
                        transaction_date: date,
                        merchant: merchant || '未知商户',
                        amount: amount,
                    });
                }
            }
        });

        console.log(`提取到 ${transactions.length} 条交易`);
        return transactions;
    }

    async function analyzeTransactions(transactions) {
        return new Promise((resolve, reject) => {
            chrome.runtime.sendMessage({ type: 'ANALYZE_BILL', data: transactions }, (response) => {
                if (chrome.runtime.lastError) return reject(new Error(chrome.runtime.lastError.message));
                if (response.error) return reject(new Error(response.error));
                resolve(response.result);
            });
        });
    }

    function displayResults({ report, rawData }) {
        reportContent.innerHTML = `<div style="font-family: monospace; white-space: pre-wrap;">${report}</div>
            <div style="margin-top: 15px;">
                <button id="exportBtn" class="btn">导出为CSV</button>
                <button id="detailsBtn" class="btn" style="background: #6c757d; margin-top: 5px;">在新标签页中详细分析</button>
            </div>`;
        
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            const csvContent = convertToCSV(rawData);
            downloadCSV(csvContent, 'bill_analysis.csv');
        });

        document.getElementById('detailsBtn')?.addEventListener('click', () => {
            chrome.storage.local.set({ 'transactionsData': rawData }, function() {
                chrome.tabs.create({ url: chrome.runtime.getURL('analysis/analysis.html') });
            });
        });
    }

    function setUIState(state, message = '') {
        const isLoading = state === 'loading';
        analyzeBtn.disabled = isLoading;
        statusDiv.innerHTML = `<div class="${state}">${message}</div>`;
        resultsDiv.style.display = state === 'success' ? 'block' : 'none';
    }

    function convertToCSV(data) {
        if (!data || data.length === 0) return '';
        const headers = Object.keys(data[0]).join(',');
        const rows = data.map(row =>
            Object.values(row).map(value => `"${String(value).replace(/"/g, '""')}"`).join(',')
        );
        return [headers, ...rows].join('\n');
    }

    function downloadCSV(content, filename) {
        const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }
});