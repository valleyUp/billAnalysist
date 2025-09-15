// Wait for AG Grid to be loaded
function waitForAgGrid() {
    return new Promise((resolve, reject) => {
        if (window.agGrid) {
            resolve();
        } else {
            window.addEventListener('agGridReady', resolve);
            window.addEventListener('agGridError', () => reject(new Error('AG Grid 加载失败')));
            // Timeout after 15 seconds
            setTimeout(() => reject(new Error('AG Grid 加载超时')), 15000);
        }
    });
}

document.addEventListener('DOMContentLoaded', async function() {
    // Wait for AG Grid to load
    await waitForAgGrid();

    const gridContainer = document.getElementById('grid-container');
    const statusBar = document.getElementById('custom-status-bar');

    // Apply ag-theme-quartz class for new theming API
    gridContainer.className = 'ag-theme-quartz';

    const columnDefs = [
        {
            headerName: "📅 交易日期",
            field: "transaction_date",
            sortable: true,
            filter: 'agDateColumnFilter',
            width: 130,
            cellClass: 'cell-date',
            floatingFilter: true,
            filterParams: {
                comparator: (filterLocalDateAtMidnight, cellValue) => {
                    const cellDate = new Date(cellValue);
                    if (filterLocalDateAtMidnight.getTime() === cellDate.getTime()) {
                        return 0;
                    }
                    if (cellDate < filterLocalDateAtMidnight) {
                        return -1;
                    }
                    if (cellDate > filterLocalDateAtMidnight) {
                        return 1;
                    }
                }
            }
        },
        {
            headerName: "🏪 商户名称",
            field: "merchant",
            sortable: true,
            filter: 'agTextColumnFilter',
            width: 280,
            cellClass: 'cell-merchant',
            floatingFilter: true,
            filterParams: {
                filterOptions: ['contains', 'startsWith', 'endsWith'],
                defaultOption: 'contains'
            }
        },
        {
            headerName: "💰 金额",
            field: "amount",
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 120,
            cellClass: 'cell-amount',
            floatingFilter: true,
            valueFormatter: params => {
                const value = params.value;
                const formatted = Math.abs(value).toFixed(2);
                return value < 0 ? `-¥${formatted}` : `+¥${formatted}`;
            },
            cellRenderer: params => {
                const value = params.value;
                const formatted = Math.abs(value).toFixed(2);
                const isNegative = value < 0;
                const cellClass = isNegative ? 'negative' : 'positive';
                const symbol = isNegative ? '-' : '+';
                return `<span class="cell-amount ${cellClass}">${symbol}¥${formatted}</span>`;
            },
            comparator: (valueA, valueB) => valueA - valueB
        },
        {
            headerName: "🏷️ 分类",
            field: "category",
            sortable: true,
            filter: 'agTextColumnFilter',
            width: 120,
            cellClass: 'cell-category',
            floatingFilter: true,
            cellRenderer: params => {
                if (!params.value) return '';
                return `<div class="cell-category"><span class="category-tag">${params.value}</span></div>`;
            },
            filterParams: {
                filterOptions: ['contains', 'equals'],
                defaultOption: 'equals'
            }
        },
        {
            headerName: "📊 交易类型",
            field: "transaction_type",
            width: 110,
            sortable: true,
            filter: 'agTextColumnFilter',
            floatingFilter: true,
            valueGetter: params => {
                const amount = params.data.amount;
                const merchant = params.data.merchant;
                if (amount < 0) {
                    return '支出';
                }
                const repaymentKeywords = ['还款', '转账', '手机银行'];
                const isRepayment = repaymentKeywords.some(keyword => merchant.includes(keyword));
                if (isRepayment) {
                    return '还款';
                }
                return '退款/收入';
            },
            cellRenderer: params => {
                const type = params.value;
                let icon = '';
                let className = '';
                switch(type) {
                    case '支出':
                        icon = '📤';
                        className = 'type-expense';
                        break;
                    case '还款':
                        icon = '💳';
                        className = 'type-repayment';
                        break;
                    case '退款/收入':
                        icon = '📥';
                        className = 'type-income';
                        break;
                }
                return `<span class="transaction-type ${className}">${icon} ${type}</span>`;
            },
            filterParams: {
                filterOptions: ['contains', 'equals'],
                defaultOption: 'equals'
            }
        }
    ];

    function updateStatusBar(api) {
        let total = 0;
        let expenseTotal = 0;
        let incomeTotal = 0;
        let count = 0;

        api.forEachNodeAfterFilter(node => {
            const amount = Number(node.data.amount);
            total += amount;
            count++;

            if (amount < 0) {
                expenseTotal += Math.abs(amount);
            } else {
                incomeTotal += amount;
            }
        });

        const totalClass = total >= 0 ? 'positive' : 'negative';
        const totalFormatted = Math.abs(total).toFixed(2);
        const totalSymbol = total >= 0 ? '+' : '-';

        statusBar.innerHTML = `
            <div class="status-info">
                <span>📊 显示 ${count} 条交易</span>
                <span>📤 支出: ¥${expenseTotal.toFixed(2)}</span>
                <span>📥 收入: ¥${incomeTotal.toFixed(2)}</span>
            </div>
            <div class="status-amount ${totalClass}">
                净额: ${totalSymbol}¥${totalFormatted}
            </div>
        `;
    }

    function addToolbarActions() {
        const toolbar = document.createElement('div');
        toolbar.className = 'grid-toolbar';
        toolbar.innerHTML = `
            <div class="toolbar-section">
                <h2 class="toolbar-title">💳 信用卡账单详细分析</h2>
                <div class="quick-filters">
                    <div class="filter-group">
                        <label>分类筛选：</label>
                        <select id="categoryFilter" class="filter-select">
                            <option value="">全部分类</option>
                            <option value="餐饮">餐饮</option>
                            <option value="购物">购物</option>
                            <option value="交通">交通</option>
                            <option value="娱乐">娱乐</option>
                            <option value="医疗">医疗</option>
                            <option value="教育">教育</option>
                            <option value="其他">其他</option>
                        </select>
                    </div>
                    <div class="filter-group">
                        <label>交易类型：</label>
                        <select id="typeFilter" class="filter-select">
                            <option value="">全部类型</option>
                            <option value="支出">支出</option>
                            <option value="还款">还款</option>
                            <option value="退款/收入">退款/收入</option>
                        </select>
                    </div>
                </div>
            </div>
            <div class="toolbar-actions">
                <button class="toolbar-btn" id="exportCsvBtn">
                    <span>📥</span> 导出CSV
                </button>
                <button class="toolbar-btn" id="exportJsonBtn">
                    <span>📋</span> 导出JSON
                </button>
                <button class="toolbar-btn" id="clearFiltersBtn">
                    <span>🔄</span> 清除筛选
                </button>
            </div>
        `;

        gridContainer.insertAdjacentElement('beforebegin', toolbar);
        return toolbar;
    }

    chrome.storage.local.get('transactionsData', function(data) {
        if (data.transactionsData) {
            // Add toolbar before creating grid
            const toolbar = addToolbarActions();

            const gridOptions = {
                columnDefs: columnDefs,
                rowData: data.transactionsData,
                defaultColDef: {
                    resizable: true,
                    floatingFilter: true,
                    minWidth: 100,
                    cellDataType: false
                },
                animateRows: true,
                rowSelection: {
                    mode: 'multiRow',
                    enableClickSelection: false
                },
                pagination: true,
                paginationPageSize: 50,
                rowHeight: 48,
                headerHeight: 56,
                floatingFiltersHeight: 40,
                getRowStyle: params => {
                    if (params.node.rowIndex % 2 === 0) {
                        return { backgroundColor: 'rgba(102, 126, 234, 0.03)' };
                    }
                    return null;
                },
                onGridReady: (params) => {
                    updateStatusBar(params.api);
                    params.api.sizeColumnsToFit();
                },
                onFilterChanged: (params) => {
                    updateStatusBar(params.api);
                },
                onSortChanged: (params) => {
                    updateStatusBar(params.api);
                }
            };

            const grid = agGrid.createGrid(gridContainer, gridOptions);

            // Add event listeners for toolbar buttons
            document.getElementById('exportCsvBtn')?.addEventListener('click', () => {
                grid.api.exportDataAsCsv({
                    fileName: `信用卡账单分析_${new Date().toISOString().split('T')[0]}.csv`
                });
            });

            document.getElementById('exportJsonBtn')?.addEventListener('click', () => {
                const allData = [];
                grid.api.forEachNodeAfterFilter(node => allData.push(node.data));
                const dataStr = JSON.stringify(allData, null, 2);
                const blob = new Blob([dataStr], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `信用卡账单分析_${new Date().toISOString().split('T')[0]}.json`;
                link.click();
                URL.revokeObjectURL(url);
            });

            document.getElementById('clearFiltersBtn')?.addEventListener('click', () => {
                grid.api.setFilterModel(null);
                grid.api.setSortModel(null);
                document.getElementById('categoryFilter').value = '';
                document.getElementById('typeFilter').value = '';
            });

            // Add custom filter event listeners
            document.getElementById('categoryFilter')?.addEventListener('change', (e) => {
                const filterValue = e.target.value;
                if (filterValue) {
                    grid.api.setColumnFilterModel('category', {
                        type: 'equals',
                        filter: filterValue
                    });
                } else {
                    grid.api.setColumnFilterModel('category', null);
                }
            });

            document.getElementById('typeFilter')?.addEventListener('change', (e) => {
                const filterValue = e.target.value;
                if (filterValue) {
                    grid.api.setColumnFilterModel('transaction_type', {
                        type: 'equals',
                        filter: filterValue
                    });
                } else {
                    grid.api.setColumnFilterModel('transaction_type', null);
                }
            });

        } else {
            gridContainer.innerHTML = `
                <div style="
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    height: 100%;
                    color: var(--muted);
                    font-size: 18px;
                    gap: 16px;
                ">
                    <div style="font-size: 48px;">📊</div>
                    <div>没有找到账单数据</div>
                    <div style="font-size: 14px; opacity: 0.7;">请先在popup中分析账单数据</div>
                </div>
            `;
        }
    });
});
