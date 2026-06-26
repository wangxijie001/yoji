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
  memory: ['AGENTS.md'],          // 记忆文件路径
  skills: ['/skills/builtin/'],   // Skill 目录
  checkpointer: new SqliteSaver(/* ... */),
  interruptOn: {                  // Human-in-the-loop 审批
    execute: true,
  },
  permissions: [                  // 文件权限规则
    { operations: ['read', 'write'], paths: ['/**'], mode: 'allow' },
  ],
})
```

## 调用

```ts
const result = await agent.invoke({
  messages: [{ role: 'user', content: '你好' }],
})
```

## 关键参数说明

| 参数 | 类型 | 说明 |
|------|------|------|
| `model` | `BaseLanguageModel` | 语言模型 |
| `systemPrompt` | `string` | 系统提示词 |
| `tools` | `StructuredTool[]` | 自定义工具列表 |
| `backend` | `FilesystemBackend` / `LocalShellBackend` | 文件系统后端，详见 [filesystem 文档](deepagents-filesystem.md) |
| `memory` | `string[]` | 记忆文件路径（如 `['AGENTS.md']`） |
| `skills` | `string[]` | Skill 目录路径 |
| `checkpointer` | `BaseCheckpointSaver` | 持久化检查点（HITL 必需） |
| `interruptOn` | `Record<string, boolean \| InterruptOnConfig>` | 工具审批配置，详见 [middleware 文档](deepagents-middleware.md) |
| `permissions` | `FilesystemPermission[]` | 文件权限规则，详见 [middleware 文档](deepagents-middleware.md) |
| `subagents` | `SubAgent[]` | 子代理定义 |
| `middleware` | `AgentMiddleware[]` | 自定义中间件 |

## 版本

| 版本 | 时间 | 关键变化 |
|------|------|------|
| v1.10.5 | 2026.06 | `interruptOn`、`FilesystemPermission`、`LocalShellBackend` |
| v1.9+ | 2026.05 | 异步子代理、Streaming v3 |
| v1.7+ | 2026.04 | 可插拔沙箱、自动摘要 |
