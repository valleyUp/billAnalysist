import React from 'react';
import ReactDOM from 'react-dom/client';
import '@mantine/core/styles.css';
import 'styles/global.css';
import PopupApp from './PopupApp';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <PopupApp />
  </React.StrictMode>
);
