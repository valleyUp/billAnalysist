# Project Overview
- Chrome extension (Manifest V3) that parses credit-card bill pages and produces local spending analysis, originally written in Chinese.
- Frontend built with React 18 + TypeScript, styled with Mantine components and global CSS.
- Bundled by Vite 5 with the React SWC plugin; output placed in `dist/` with custom plugin to move HTML entrypoints.
- Core logic lives in `src/shared` (types, formatting helpers, bill analyzer); popup UI under `src/popup`, detailed analysis page under `src/analysis`, background service worker in `src/background`.
- Ships statically with no backend; data persists via `chrome.storage` and new tabs created with `chrome.runtime` APIs.
