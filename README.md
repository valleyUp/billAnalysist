# 信用卡账单分析器 Chrome 扩展 (重构版)

这是一个用于自动分析信用卡账单邮件的Chrome浏览器扩展。当您在邮箱中查看信用卡账单时，可以一键提取交易数据并进行消费分析。

## 功能特性

- 🔍 自动检测邮箱中的信用卡账单页面
- ⚛️ 基于 React + Mantine 构建弹窗与分析页面，体验更加现代
- 📊 提取交易日期、商户名称、交易金额数据
- 📈 生成详细的消费分析报告，并展示按分类、金额占比等统计
- 💾 支持导出分析结果为 CSV 文件
- 🎯 智能分类消费类型（餐饮、交通、购物等）
- 🧮 Mantine Table 替换 AG Grid，提供内置的筛选、排序、检索能力

## 安装方法

1. 打开Chrome浏览器，进入扩展管理页面：`chrome://extensions/`
2. 开启“开发者模式”
3. 在项目根目录执行 `npm install`
4. 构建产物：`npm run build`
5. 在扩展管理页点击“加载已解压的扩展程序”
6. 选择生成的 `dist` 目录
7. 扩展安装完成

## 使用方法

1. 打开您的邮箱，找到信用卡账单邮件
2. 点击浏览器工具栏中的扩展图标
3. 点击"分析当前页面账单"按钮
4. 查看生成的消费分析报告
5. 可选：点击"导出为CSV"保存分析结果
6. 可选：点击"在新标签页中详细分析"查看详细的交易数据表格

## 支持的信箱

- Gmail
- Outlook
- 网易邮箱
- QQ邮箱
- 其他常见邮箱服务

## 数据隐私

本扩展仅在本地处理数据，不会将任何信息发送到远程服务器。所有分析操作都在浏览器中完成。

## 文件结构

```
.
├── public/
│   └── manifest.json              # MV3 清单文件，构建时复制到 dist
├── src/
│   ├── apps/
│   │   ├── popup/
│   │   │   ├── index.html
│   │   │   ├── main.tsx           # Popup 入口 (挂载 React)
│   │   │   └── PopupApp.tsx       # Popup 应用逻辑
│   │   └── analysis/
│   │       ├── index.html
│   │       ├── main.tsx           # 分析页入口 (挂载 React)
│   │       ├── AnalysisApp.tsx    # 分析页主体逻辑
│   │       └── components/
│   │           └── TransactionTable.tsx
│   ├── background/
│   │   └── index.ts               # Service Worker，负责后台分析
│   ├── lib/
│   │   ├── analyzer/
│   │   │   ├── BillAnalyzer.ts
│   │   │   └── index.ts
│   │   ├── data/
│   │   │   └── categories.json    # 消费分类关键字
│   │   ├── format/
│   │   │   └── index.ts           # 金额、日期、CSV 工具
│   │   └── types/
│   │       └── index.ts           # 公共类型定义
│   └── styles/
│       └── global.css             # 全局样式重置
├── package.json
├── tsconfig.json
├── vite.config.ts
└── README.md
```

## 开发说明

该项目基于 React + TypeScript 构建，通过 Vite 输出符合 Manifest V3 的扩展包，无需任何后端服务。所有分析逻辑均在浏览器侧完成。

### 开发命令

- `npm run dev`：Vite 开启构建监听，适合在开发阶段实时生成 `dist`
- `npm run build`：生成用于加载的 `dist` 目录
- `npm run lint`：执行 TypeScript 类型检查

### 项目特点

1. 使用 Chrome Extension Manifest V3 API
2. 使用 React + Mantine 实现弹窗与分析页的现代化界面
3. Mantine Table 支撑筛选、排序、搜索等详细账目操作
4. `lib/analyzer` 中的 `BillAnalyzer` 服务工作线程统一负责分类、汇总逻辑
5. 所有数据在本地运行，无需远程依赖
