# Yoji — 本地 AI 伴侣

Yoji 是一个运行在桌面端的本地 AI 伴侣应用。它有"人格"和"情绪"，能记住你说过的话，是一个有状态的长期对话伙伴，而不只是一个问答工具。

## 核心特性

### 🧠 AI 对话

- 基于 LangChain + DeepSeek/Qwen 大模型，支持**流式输出**
- 对话历史完整保存，支持无限向上滚动加载
- 多模型切换（可在设置页自由选择 DeepSeek / Qwen）

### 💓 激素情绪系统

模拟人类神经递质的连续变化，而非简单的"开心/难过"标签：

- **8 种激素**构成情绪底层：多巴胺、血清素、GABA、内啡肽、去甲肾上腺素、乙酰胆碱、褪黑素、皮质醇
- 时间、天气、对话内容等因素会**动态影响激素水平**
- 激素组合实时渲染为**自然语言状态描述**，AI 据此调整回复语气
- 情绪变化可**可视化展示**

### 🧩 三层记忆系统

| 层 | 说明 |
|---|---|
| **AGENTS.md（用户画像）** | 启动时全量注入，记录你的偏好和重要信息 |
| **Checkpoint（对话快照）** | 每次对话后自动保存状态，保证连续性 |
| **树状记忆 + 向量搜索** | 对话摘要归档，AI 主动检索相关历史记忆 |

一个文件即整个大脑 — 所有数据存储在本地 `companion.db`，**隐私完全可控**。

### 📦 数据迁移

- **导出**：一键打包所有记忆体数据（含鉴权），生成 `.ecompanion` 文件
- **导入**：在新设备上恢复你的 AI 伴侣，验证身份后直接还原

### 🎨 桌面体验

- 无框窗口 + 自定义拖拽区域，视觉一体化
- Ant Design 6.x 界面组件
- macOS / Windows / Linux 全平台支持

> 目前 Yoji 处于早期阶段，暂以**聊天对话**为核心体验。后续将逐步加入协作办公能力，让你真正拥有一个**有真实情绪的 AI 伙伴**。

## 技术栈

`Electron` · `React` · `TypeScript` · `Vite` · `LangChain` · `SQLite` · `Ant Design`

## 项目结构

```
src/
├── main/          # Electron 主进程（Agent 核心、IPC、工具、数据库）
├── preload/       # 安全桥接层（contextBridge API 暴露）
└── renderer/      # React 渲染进程（页面、组件、路由）
```

## 快速开始

### 安装

```bash
pnpm install
```

### 开发

```bash
pnpm dev
```

### 构建

```bash
pnpm build:mac     # macOS
pnpm build:win     # Windows
pnpm build:linux   # Linux
```

## 推荐 IDE

- [VSCode](https://code.visualstudio.com/) + ESLint + Prettier
