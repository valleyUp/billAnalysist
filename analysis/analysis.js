document.addEventListener('DOMContentLoaded', function() {
    const gridContainer = document.getElementById('grid-container');
    const statusBar = document.getElementById('custom-status-bar');

    const columnDefs = [
        { headerName: "交易日期", field: "transaction_date", sortable: true, filter: true, width: 150 },
        { headerName: "商户", field: "merchant", sortable: true, filter: 'agTextColumnFilter', flex: 1 },
        {
            headerName: "金额",
            field: "amount",
            sortable: true,
            filter: 'agNumberColumnFilter',
            width: 150,
            valueFormatter: params => params.value.toFixed(2) + ' 元',
            cellStyle: params => params.value < 0 ? { color: '#d9534f' } : { color: '#5cb85c' }
        },
        { headerName: "分类", field: "category", sortable: true, filter: true, width: 150 },
        {
            headerName: "交易类型",
            width: 150,
            sortable: true,
            filter: true,
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
            }
        }
    ];

    function updateFooterSum(api) {
        let total = 0;
        api.forEachNodeAfterFilter(node => {
            total += Number(node.data.amount);
        });
        statusBar.innerHTML = `筛选后合计: ${total.toFixed(2)} 元`;
    }

    chrome.storage.local.get('transactionsData', function(data) {
        if (data.transactionsData) {
            const gridOptions = {
                columnDefs: columnDefs,
                rowData: data.transactionsData,
                defaultColDef: {
                    resizable: true,
                    floatingFilter: true,
                },
                animateRows: true,
                theme: "legacy",
                onGridReady: (params) => {
                    updateFooterSum(params.api);
                },
                onFilterChanged: (params) => {
                    updateFooterSum(params.api);
                }
            };
            agGrid.createGrid(gridContainer, gridOptions);
        } else {
            gridContainer.innerHTML = '没有找到账单数据。';
        }
    });
});