document.addEventListener('DOMContentLoaded', function() {
    const analyzeBtn = document.getElementById('analyzeBtn');
    const statusDiv = document.getElementById('status');
    const resultsDiv = document.getElementById('results');
    const reportContent = document.getElementById('reportContent');

    analyzeBtn.addEventListener('click', handleAnalysis);

    // Add keyboard shortcuts
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case 'Enter':
                    e.preventDefault();
                    if (!analyzeBtn.disabled) {
                        handleAnalysis();
                    }
                    break;
                case 'r':
                    e.preventDefault();
                    if (!analyzeBtn.disabled) {
                        handleAnalysis();
                    }
                    break;
            }
        }
    });

    // Add loading animation to button
    function setButtonLoading(loading) {
        if (loading) {
            analyzeBtn.innerHTML = `
                <div class="loading-spinner"></div>
                正在分析...
            `;
            analyzeBtn.disabled = true;
        } else {
            analyzeBtn.innerHTML = `
                <span>📊</span>
                分析当前页面账单
            `;
            analyzeBtn.disabled = false;
        }
    }

    async function handleAnalysis() {
        setButtonLoading(true);
        setUIState('loading', '🔄 正在提取账单数据...');

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            const injectionResult = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: extractBillDataFromPage,
            });

            const transactions = injectionResult?.[0]?.result ?? [];

            if (transactions.length === 0) {
                setUIState('error', '❌ 未找到交易数据，请确保页面是正确的信用卡账单。');
                setButtonLoading(false);
                return;
            }

            setUIState('loading', `🔄 分析 ${transactions.length} 条交易数据...`);
            const analysisResult = await analyzeTransactions(transactions);
            displayResults(analysisResult);
            setUIState('success', `✅ 分析完成！发现 ${transactions.length} 条交易记录。`);
        } catch (error) {
            console.error('分析错误:', error);
            setUIState('error', `❌ 分析失败: ${error.message}`);
        } finally {
            setButtonLoading(false);
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
        reportContent.innerHTML = `
            <div class="report-summary">
                <div class="summary-header">
                    <h4>📈 分析摘要</h4>
                </div>
                <div class="report-content" style="font-family: 'SF Mono', Monaco, 'Cascadia Code', 'Roboto Mono', Consolas, 'Courier New', monospace; white-space: pre-wrap; font-size: 13px; line-height: 1.6;">${report}</div>
            </div>
            <div class="action-buttons">
                <button id="exportBtn" class="btn">
                    <span>📥</span>
                    导出为CSV
                </button>
                <button id="detailsBtn" class="btn btn-secondary">
                    <span>🔍</span>
                    详细分析 (Ctrl+D)
                </button>
                <button id="copyBtn" class="btn btn-secondary">
                    <span>📋</span>
                    复制报告
                </button>
            </div>`;

        // Add event listeners with enhanced feedback
        document.getElementById('exportBtn')?.addEventListener('click', () => {
            const csvContent = convertToCSV(rawData);
            downloadCSV(csvContent, `信用卡账单_${new Date().toISOString().split('T')[0]}.csv`);
            showToast('📥 CSV文件下载成功！');
        });

        document.getElementById('detailsBtn')?.addEventListener('click', () => {
            chrome.storage.local.set({ 'transactionsData': rawData }, function() {
                chrome.tabs.create({ url: chrome.runtime.getURL('analysis/analysis.html') });
                showToast('🔍 正在打开详细分析页面...');
            });
        });

        document.getElementById('copyBtn')?.addEventListener('click', () => {
            navigator.clipboard.writeText(report).then(() => {
                showToast('📋 报告已复制到剪贴板！');
            }).catch(() => {
                showToast('❌ 复制失败，请手动复制', 'error');
            });
        });

        // Add global keyboard shortcuts
        document.addEventListener('keydown', function(e) {
            if (e.ctrlKey || e.metaKey) {
                switch(e.key) {
                    case 'd':
                        e.preventDefault();
                        document.getElementById('detailsBtn')?.click();
                        break;
                    case 's':
                        e.preventDefault();
                        document.getElementById('exportBtn')?.click();
                        break;
                    case 'c':
                        if (e.shiftKey) {
                            e.preventDefault();
                            document.getElementById('copyBtn')?.click();
                        }
                        break;
                }
            }
        });
    }

    function setUIState(state, message = '') {
        statusDiv.innerHTML = `<div class="${state}">${message}</div>`;
        resultsDiv.style.display = state === 'success' ? 'block' : 'none';
    }

    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 16px;
            border-radius: 8px;
            background: ${type === 'error' ? 'var(--error-bg)' : 'var(--success-bg)'};
            color: ${type === 'error' ? 'var(--error-fg)' : 'var(--success-fg)'};
            font-size: 14px;
            font-weight: 500;
            box-shadow: var(--shadow);
            z-index: 1000;
            animation: slideInRight 0.3s ease-out;
        `;

        document.body.appendChild(toast);

        setTimeout(() => {
            toast.style.animation = 'slideOutRight 0.3s ease-in';
            setTimeout(() => {
                document.body.removeChild(toast);
            }, 300);
        }, 3000);
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
        const blob = new Blob(['\uFEFF' + content], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    // Add help tooltip
    const helpTooltip = document.createElement('div');
    helpTooltip.className = 'help-tooltip';
    helpTooltip.innerHTML = `
        <div class="tooltip-content">
            <h5>💡 快捷键提示</h5>
            <ul>
                <li><kbd>Ctrl+Enter</kbd> 或 <kbd>Ctrl+R</kbd> - 分析账单</li>
                <li><kbd>Ctrl+D</kbd> - 打开详细分析</li>
                <li><kbd>Ctrl+S</kbd> - 导出CSV</li>
                <li><kbd>Ctrl+Shift+C</kbd> - 复制报告</li>
            </ul>
        </div>
    `;

    // Add CSS for animations and tooltips
    const styles = document.createElement('style');
    styles.textContent = `
        .loading-spinner {
            width: 16px;
            height: 16px;
            border: 2px solid rgba(255,255,255,0.3);
            border-top: 2px solid white;
            border-radius: 50%;
            animation: spin 1s linear infinite;
        }

        .report-summary {
            background: rgba(255,255,255,0.05);
            border-radius: var(--border-radius-sm);
            padding: 16px;
            margin-bottom: 16px;
        }

        .summary-header h4 {
            margin: 0 0 12px 0;
            color: var(--accent-solid);
            font-size: 16px;
            font-weight: 600;
        }

        .action-buttons {
            display: flex;
            flex-direction: column;
            gap: 8px;
            margin-top: 16px;
        }

        .help-tooltip {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: var(--card);
            border: 1px solid var(--border);
            border-radius: var(--border-radius-sm);
            padding: 16px;
            box-shadow: var(--shadow);
            font-size: 12px;
            max-width: 250px;
            z-index: 100;
            opacity: 0;
            transform: translateY(20px);
            transition: var(--transition);
        }

        .help-tooltip.show {
            opacity: 1;
            transform: translateY(0);
        }

        .tooltip-content h5 {
            margin: 0 0 8px 0;
            font-size: 14px;
            color: var(--text);
        }

        .tooltip-content ul {
            margin: 0;
            padding-left: 16px;
            list-style: none;
        }

        .tooltip-content li {
            margin-bottom: 4px;
            font-size: 12px;
            color: var(--text-secondary);
        }

        kbd {
            background: var(--border);
            border: 1px solid var(--muted);
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 11px;
            font-family: monospace;
        }

        @keyframes slideInRight {
            from {
                opacity: 0;
                transform: translateX(100px);
            }
            to {
                opacity: 1;
                transform: translateX(0);
            }
        }

        @keyframes slideOutRight {
            from {
                opacity: 1;
                transform: translateX(0);
            }
            to {
                opacity: 0;
                transform: translateX(100px);
            }
        }
    `;

    document.head.appendChild(styles);
    document.body.appendChild(helpTooltip);

    // Show help tooltip briefly on load
    setTimeout(() => {
        helpTooltip.classList.add('show');
        setTimeout(() => {
            helpTooltip.classList.remove('show');
        }, 4000);
    }, 1000);
});