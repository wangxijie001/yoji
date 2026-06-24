# 摘要中间件

> DeepAgents 内置 `createSummarizationMiddleware`，防止对话上下文无限膨胀。

## 原理

```
对话持续进行，消息越来越多
    │
    ▼
消息 token 数达到触发阈值
    │
    ▼
SummarizationMiddleware 自动触发：
  1. 旧消息存档到 Backend（框架要求，我们用 StateBackend 走形式）
  2. 调用 LLM 生成结构化摘要
  3. 用摘要替换旧消息，保留最近 N 条消息
```

## 与 Checkpoint 的关系

摘要是上下文窗口内的压缩，checkpoint 是完整状态的持久化。两者互补：

| | 摘要中间件 | Checkpointer |
|---|---|---|
| 管什么 | 上下文占用 | 对话状态 |
| 效果 | 用摘要替换旧消息，腾出 token | 完整对话写入 companion.db |
| 丢失原文吗 | 上下文中丢了 | ❌ 没丢，checkpoint 里全有 |

所以我们的 `backend` 用 `StateBackend`（内存）就够了——旧消息不需要额外存档，checkpointer 已经存了。

## 配置

```ts
import { createSummarizationMiddleware, StateBackend } from 'deepagents'

const middleware = createSummarizationMiddleware({
  trigger: [
    { type: 'messages', value: 50 },    // 满 50 条消息
    { type: 'tokens', value: 20000 },   // 达到 20000 token
    { type: 'fraction', value: 0.5 },   // 达到模型上限的 50%
  ],
  keep: { type: 'messages', value: 12 }, // 保留最近 12 条
  backend: (config) => new StateBackend(config),
})
```

### 触发条件（OR 关系）

`deepagents` 的 `ContextSize` 格式为 `{ type, value }`：

| type | 含义 | 我们的值 | 说明 |
|---|---|---|---|
| `messages` | 消息条数 | 50 | 约 25 轮对话 |
| `tokens` | token 数 | 20000 | 辅助安全网 |
| `fraction` | 模型上限占比 | 0.5 | 保证不过半 |

满足任一条件即触发摘要。

### keep：保留最近消息

摘要后保留最近 N 条消息，维持对话连贯性。设置过大会降低摘要效果，过小会导致上下文断裂。建议 8-20 条。

### model：摘要用模型

默认复用 `createDeepAgent` 的 `model`（主模型）。可传入独立模型节省成本：

```ts
createSummarizationMiddleware({
  model: new ChatOpenAI({ model: 'gpt-4o-mini' }),  // 便宜模型
  // ...
})
```

## 我们项目的实现

[src/main/agent/middleware/summarization.ts](../../src/main/agent/middleware/summarization.ts) — 封装为工厂函数，暂时复用主模型，后续可扩展独立模型。
