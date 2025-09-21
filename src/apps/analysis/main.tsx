import React from 'react';
import ReactDOM from 'react-dom/client';
import { MantineProvider } from '@mantine/core';
import AnalysisApp from './AnalysisApp';
import '@mantine/core/styles.css';
import 'styles/global.css';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <MantineProvider defaultColorScheme="auto">
      <AnalysisApp />
    </MantineProvider>
  </React.StrictMode>
);
