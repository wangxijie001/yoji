# DeepAgents 子代理

子代理有**隔离的上下文窗口**，处理完返回精简结果。

## 定义

```ts
import type { SubAgent } from 'deepagents'

const researchAgent: SubAgent = {
  name: 'research-agent',
  description: '深度调研时使用此代理',
  systemPrompt: '你是一个研究员...',
  tools: [searchTool],        // 独立工具集，可选
  model: 'gpt-4o',            // 可选，不指定则继承主代理
  middleware: [],              // 可选，独立中间件
}
```

## 两种模式

| 模式 | 行为 | 适用 |
|---|---|---|
| Inline | 阻塞主代理直到完成 | 短任务 |
| Async (v0.5+) | 非阻塞，返回 taskId，随时收结果 | 长任务、并行任务 |

## 内置 task 工具

Agent 内置 `task` 工具，运行时动态 spawn 子代理，无需预先定义所有子代理。

## 权限

子代理默认继承父代理的文件系统权限，也可单独声明读写规则。
