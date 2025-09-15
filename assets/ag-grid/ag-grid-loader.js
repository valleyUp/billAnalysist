// AG Grid Loader - Prioritizes local file with CDN fallback
(function() {
    'use strict';

    // Check if AG Grid is already loaded
    if (window.agGrid) {
        console.log('AG Grid already loaded');
        window.dispatchEvent(new CustomEvent('agGridReady'));
        return;
    }

    function loadFromCDN() {
        console.log('Loading AG Grid from CDN...');
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/ag-grid-community@34.1.2/dist/ag-grid-community.min.js';
        script.crossOrigin = 'anonymous';
        script.onload = function() {
            console.log('AG Grid v34.1.2 loaded successfully from CDN');
            window.dispatchEvent(new CustomEvent('agGridReady'));
        };
        script.onerror = function() {
            console.error('Failed to load AG Grid from both local and CDN sources');
            window.dispatchEvent(new CustomEvent('agGridError'));
        };
        document.head.appendChild(script);
    }

    // Try to load from local file first
    console.log('Loading AG Grid from local file...');
    const script = document.createElement('script');

    // Use relative path for local file
    const currentScript = document.currentScript || document.querySelector('script[src*="ag-grid-loader"]');
    const baseUrl = currentScript ? currentScript.src.replace(/ag-grid-loader\.js$/, '') : './assets/ag-grid/';

    script.src = baseUrl + 'ag-grid-community.min.js';
    script.onload = function() {
        console.log('AG Grid v34.1.2 loaded successfully from local file');
        window.dispatchEvent(new CustomEvent('agGridReady'));
    };
    script.onerror = function() {
        console.warn('Failed to load AG Grid from local file, trying CDN...');
        loadFromCDN();
    };
    document.head.appendChild(script);
})();