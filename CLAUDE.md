# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

本地 AI Agent 桌面应用。技术栈：Electron + React + TypeScript + Vite，基于 `electron-vite` 脚手架创建，包管理器 pnpm。

## 常用命令

```bash
pnpm install              # 安装依赖
pnpm dev                  # 启动开发环境（支持 HMR 热更新）
pnpm build                # 类型检查 + 构建
pnpm build:mac            # 构建并打包 macOS 应用
pnpm build:win            # 构建并打包 Windows 应用
pnpm format               # Prettier 格式化代码
pnpm lint                 # ESLint 检查
pnpm typecheck            # 运行所有 TypeScript 类型检查
```

## 三进程架构

Electron 应用由三个独立进程组成，源码分别对应 `src/` 下的三个目录：

### 1. 主进程 (`src/main/`)
Node.js 环境，负责窗口创建、系统交互、IPC 通信。**LangChain Agent、模型调用、文件读写、工具执行等核心逻辑全部在这里**。

```
src/main/
├── index.ts               # 入口：窗口创建 + 注册所有 IPC
├── config.ts              # 配置读写（getConfig/setConfig）
├── http.ts                # HTTP 请求工具
├── ipc/                   # IPC 处理器
│   ├── index.ts           # registerAll() 汇总注册
│   ├── agent.ts           # agent:chat / agent:chat:stream（流式对话）
│   ├── config.ts          # 配置 IPC
│   ├── emotion.ts         # emotion:log（情绪日志查询）
│   ├── file.ts            # file:readAgentsMd / file:export / file:import
│   ├── http.ts            # HTTP IPC
│   └── broadcast.ts       # 通用广播工具（主→渲染主动推送）
└── agent/                 # AI Agent 核心
    ├── index.ts           # Agent 初始化、checkpointer、companion 目录
    ├── model.ts           # 模型工厂（DeepSeek / Qwen）
    ├── system-prompt.ts   # System Prompt 构建
    ├── emotion/           # 激素情绪系统
    │   ├── schema.ts      # emotion_log 表操作（CRUD）
    │   ├── index.ts       # changeEmotion() 情绪变化引擎
    │   └── emotion_model.ts # LLM 情绪分析
    ├── tools/             # Agent 工具集
    ├── skills/            # 内置 Skills
    ├── middleware/         # Agent 中间件
    └── utils/             # checkpoint 清理、chat-history 等
```

### 2. 预加载脚本 (`src/preload/`)
主进程和渲染进程之间的安全桥梁，通过 `contextBridge.exposeInMainWorld()` 将 API 暴露到渲染进程的 `window` 对象上。

```
src/preload/
├── index.ts               # contextBridge 注册入口
├── index.d.ts             # window.api 完整类型声明（所有 API 类型的真相源）
└── api/
    ├── index.ts           # 汇总所有 API 到 window.api
    ├── agent.ts           # chat / chatStream / historyQuery
    ├── config.ts          # 配置读写
    ├── emotion.ts         # getLog / onUpdated
    ├── file.ts            # readAgentsMd / exportFile / importFile
    ├── http.ts            # HTTP 请求
    └── listener.ts        # createListener<T>() 通用监听器工厂
```

### 3. 渲染进程 (`src/renderer/`)
普通 React 应用，运行在 Chromium 浏览器环境里。`@renderer` 别名映射到 `src/renderer/src/`。

```
src/renderer/
├── index.html               # HTML 入口（含 CSP 安全策略）
└── src/
    ├── main.tsx             # React 挂载点
    ├── App.tsx              # 根组件，HashRouter + Ant Design ConfigProvider
    ├── routes.tsx           # 路由配置（react-router-dom v7）
    ├── pages/
    │   ├── home/            # 首页（布局框架 + 菜单 + 情绪背景）
    │   ├── ai-chat/         # AI 对话页（无限滚动 + 流式输出）
    │   ├── modal-set/       # 模型配置页（DeepSeek / Qwen 切换）
    │   ├── param-show/      # 参数展示页
    │   ├── diary/           # 日记页
    │   └── file-manage/     # 文件管理页（导出/导入记忆体）
    ├── components/          # 通用组件（FormatChat、echarts 等）
    ├── api/                 # 渲染进程 API 封装层（处理 error toast）
    │   ├── agent.ts
    │   ├── config.ts
    │   ├── emotion.ts
    │   ├── file.ts
    │   └── server.ts
    └── assets/              # CSS、SVG、iconfont 等静态资源
```

## IPC 通信模式

### 模式一：请求-响应（渲染 → 主）

```
渲染进程:  window.api.xxx(params)
预加载:    ipcRenderer.invoke('channel', params)
主进程:    ipcMain.handle('channel', async (event, params) => { ... })
```

用于渲染进程主动查询数据。示例：`agent:chat`、`emotion:log`、`file:readAgentsMd`。

返回统一格式：`{ ok: boolean; data?: T; error?: string }`。

### 模式二：主动推送（主 → 渲染）

```
主进程:    broadcast('channel', data)              // src/main/ipc/broadcast.ts
预加载:    createListener<T>('channel')             // src/preload/api/listener.ts
渲染进程:  const unsub = window.api.xxx.onUpdated(callback)
```

用于主进程在某个操作完成后主动通知渲染进程刷新 UI。示例：`insertEmotion` 后 `broadcast('emotion:updated', next)`。

`createListener` 返回的函数**自动返回取消订阅函数**，方便在 `useEffect` cleanup 中使用：

```ts
useEffect(() => {
  const unsub = window.api.emotion.onUpdated((emotion) => { ... })
  return unsub
}, [])
```

### 模式三：流式推送（主 → 渲染，多帧）

用于 AI 对话流式输出。主进程通过 `event.sender.send()` 分多次推送 chunk：

```
主进程:    event.sender.send('agent:stream:chunk', data)
预加载:    ipcRenderer.on('agent:stream:chunk', ...)
           ipcRenderer.once('agent:stream:done', ...)
```

## 数据管理

### 用户数据目录
所有运行时数据存在 `app.getPath('userData')/companion/`：

```
companion/
├── companion.db           # SQLite（聊天历史 + 情绪日志 + memory + checkpoint）
├── AGENTS.md              # 用户画像 + 主题记录
└── skills/                # 内置 Skills（SKILL.md）
```

### 导出/导入
**导出**（`file:export` with `type: 'all'`）：
- 弹出原生保存对话框，后缀 `.ecompanion`
- 遍历 companion 目录收集所有文件
- 二进制文件（.db）base64 编码
- 注入 `manifest.json`（含 `PWD_TOKEN` 鉴权识别码）
- JSON → `gzipSync` → 写入 `.ecompanion`

**导入**（`file:import`）：
- 弹出原生文件选择对话框，过滤 `.ecompanion`
- `gunzipSync` → `JSON.parse`
- 校验 `manifest.app` 和 `manifest.token`（必须匹配 `PWD_TOKEN`）
- 写回 companion 目录（直接覆盖现有文件）
- 重启后生效

### 关键常量
- `PWD_TOKEN`: `'agent_love_001'` — 导出文件鉴权识别码
- `COMPANION_DIR`: `join(app.getPath('userData'), 'companion')`

## AI 伴侣系统

### 激素情绪系统
文件：`src/main/agent/emotion/`，设计文档：`docs/companion/emotion.md`。

8 种激素连续变化 → LLM 分析 → 自然语言描述 + 显示参数：
- `changeEmotion()` 在每次对话后触发，综合考虑天气、时间、对话内容
- 结果写入 `emotion_log` 表（保留最近 300 条）
- 写完自动 `broadcast('emotion:updated', ...)` 通知渲染进程更新背景

### 记忆系统
文件：`docs/companion/memory.md`。

三层架构：
1. **AGENTS.md** — 用户画像 + 主题索引（启动时全量注入 system prompt）
2. **Checkpoint** — 对话状态快照（SqliteSaver，每次对话后保留最新）
3. **树状记忆** — 对话摘要 + 向量化搜索（sqlite-vec）

### 聊天历史
- 表：`raw_messages`，链表结构（`prev_id` / `next_id`）
- 查询：支持 `beforeId` + `limit` 分页
- 渲染进程用 `react-infinite-scroller` 做向上滚动加载更多

## 窗口配置

### 无框窗口 + 自定义拖拽
```ts
// src/main/index.ts
titleBarStyle: 'hidden'   // 隐藏原生标题栏
```

CSS 拖拽方案（`-webkit-app-region`）：
- 在特定区域（如 `.dragHandle`）设置 `-webkit-app-region: drag`
- 不要在 `body` 或 `#root` 上全局设置，避免影响所有子元素
- 若需要在容器上设置，必须对交互元素（button/input/a）设置 `no-drag`

### 滚动条样式
使用始终可见的细滚动条（4px，低透明度）：
```css
scrollbar-width: thin;
&::-webkit-scrollbar { width: 4px; }
&::-webkit-scrollbar-thumb { background: rgba(0,0,0,0.12); border-radius: 2px; }
&::-webkit-scrollbar-thumb:hover { background: rgba(0,0,0,0.30); }
```

## 已确定的技术决策

- **路由方案**：react-router-dom v7，必须用 `HashRouter`。Electron 加载本地文件走 `file://` 协议，`BrowserRouter` 依赖服务端路由，不能用。
- **包管理器**：强制 pnpm，`package.json` 中有 `pnpm` 配置段，`.npmrc` 配置了 electron 国内镜像加速。
- **IPC 通信**：`main ↔ preload ↔ renderer` 三级通信，通过 `contextBridge` 保证安全。渲染进程不能直接 `require('electron')`。
- **TypeScript 配置**：`tsconfig.node.json` 管主进程和 preload，`tsconfig.web.json` 管渲染进程，两个编译上下文互不干扰。
- **共享类型声明**：`src/shared/types.ts` 存放主进程和渲染进程共用的纯类型（interface/type/enum）。渲染进程用 `@shared/types` 导入，主进程用相对路径导入。该目录不能引用 Node.js/Electron 模块。
- **构建和打包**：`electron-vite` 统一管理三个进程的构建（开发/生产），`electron-builder` 负责最终打包成可分发的安装包。配置文件 `electron-builder.yml`。
- **用户数据存储**：运行时产生的数据必须存到 `app.getPath('userData')` 目录，不能写入项目目录，因为打包后项目目录是只读的。
- **CSS 方案**：CSS Modules（`.module.css`）处理定制样式，Ant Design 6.x 提供通用组件。
- **Agent 框架**：LangChain `deepagents`，技术文档按主题拆分在 `docs/langchain/`，入口 `docs/langchain/README.md`。
- **AI 伴侣行为模型**：激素情绪系统、三层记忆等设计文档在 `docs/companion/`，入口 `docs/companion/README.md`。
- **API 封装分层**：渲染进程 `src/api/` 封装 `window.api` 调用，统一处理 error toast 和空值兜底，页面组件直接调用 `src/api/` 而非 `window.api`。
