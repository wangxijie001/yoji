# DeepAgents 核心

> npm 包 `deepagents`，[langchain-ai/deepagentsjs](https://github.com/langchain-ai/deepagentsjs)

## 架构定位

```
deepagents（本框架）
    ↑
LangGraph（图运行时：streaming、持久化、checkpoint）
    ↑
LangChain（基础模块：模型、工具、消息）
```

`createDeepAgent()` 返回编译好的 LangGraph StateGraph，所有 LangGraph 能力原生可用。

## 安装

```bash
pnpm add deepagents @langchain/core
# 按模型选：
pnpm add @langchain/openai      # OpenAI
pnpm add @langchain/anthropic   # Anthropic
```

## 入口

| 入口 | 用途 |
|---|---|
| `deepagents` | 默认，Node.js（主进程用这个） |
| `deepagents/node` | 显式 Node.js |
| `deepagents/browser` | 浏览器安全版 |

## 创建 Agent

```ts
import { createDeepAgent } from 'deepagents'
import { ChatOpenAI } from '@langchain/openai'

const agent = createDeepAgent({
  model: new ChatOpenAI({ model: 'gpt-4o', apiKey: '...' }),
  systemPrompt: '你是一个贴心的电子伴侣...',
  tools: [],
  subagents: [],
  middleware: [],
  backend: /* 文件系统后端 */,
})
```

## 调用

```ts
const result = await agent.invoke({
  messages: [{ role: 'user', content: '你好' }],
})
```

## 版本

| 版本 | 时间 | 关键变化 |
|---|---|---|
| v0.4 | 2026.02 | 可插拔沙箱、自动摘要 |
| v0.5 | 2026.04 | 异步子代理、多模态 |
| v0.6 | 2026.05 | Code Interpreter、Streaming v3 |
