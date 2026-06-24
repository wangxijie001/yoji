# 项目落地映射

> DeepAgents 概念 → Electron 项目的具体落地方式

## 架构总览

```
src/main/agent/
├── index.ts                  ← createDeepAgent(...) 入口
│   ├── model: 动态注入用户 apiKey
│   ├── systemPrompt: 电子伴侣人设
│   ├── backend: FilesystemBackend → userData/companion/ (virtualMode)
│   ├── memory: AGENTS.md → 用户画像 + 主题记录
│   └── checkpointer: SqliteSaver → companion.db
│
├── model.ts                  ← createModel()
├── system-prompt.ts          ← buildSystemPrompt()
├── middleware/
│   └── summarization.ts      ← 摘要中间件（暂未启用，框架内置）
├── tools/
│   ├── index.ts              ← 工具注册
│   └── search-memories.ts    ← search_memories + fetch_raw_messages
└── utils/
    ├── chat-history.ts       ← 表结构 + 消息读写 + generateAndStoreSnapshot
    ├── checkpoint-cleaner.ts ← 每次对话后清理旧 checkpoint
    └── embedding.ts          ← 本地向量化 (all-MiniLM-L6-v2)

src/main/ipc/
└── agent.ts                  ← ipcMain.handle('agent:chat') / stream

src/preload/api/
└── agent.ts                  ← contextBridge 暴露的通信通道

src/renderer/src/api/
└── agent.ts                  ← 前端调用: agent.chat() / agent.stream()
```

## 关键映射

| DeepAgents 概念 | 项目落地 | 状态 |
|---|---|---|
| `model` | 用户 config 中的 apiKey + model + baseURL | ✅ 已实现 |
| `systemPrompt` | 电子伴侣人设 | ✅ 已实现 |
| **`backend`** | `FilesystemBackend`，`virtualMode: true`，映射 companion 目录 | ✅ 已实现 |
| **`memory` 参数** | AGENTS.md → 用户画像 + 主题记录，启动全量注入 | ✅ 已实现 |
| **`checkpointer`** | `SqliteSaver` → `companion.db`，对话持久化主力 | ✅ 已实现 |
| **`middleware`** | 摘要中间件，框架内置（暂未自定义阈值） | ✅ 默认可用 |
| **聊天历史** | `raw_messages` 表，自增 ID + 链表，分页查询 | ✅ 已实现 |
| **向量化** | `all-MiniLM-L6-v2` 本地 ONNX 模型，22MB，384 维 | ✅ 已实现 |
| **树状记忆** | `memory_snapshots` + `memory_embeddings` (sqlite-vec)，每 30 条自动摘要 | ✅ 已实现 |
| **记忆搜索** | `search_memories` (语义/时间) + `fetch_raw_messages` (原文) | ✅ 已实现 |
| `streaming` | IPC 逐 chunk 推送 + `agent:done` | ✅ 已实现 |
| `tools` | `query_current_time` + `search_memories` + `fetch_raw_messages` | ✅ 已实现 |
| `subagents` | 复杂任务的专项代理 | 📋 规划中 |
| `skills` | 伴侣行为模板，按需加载。详见 [deepagents-skills.md](deepagents-skills.md) | 📋 规划中 |

## 已实现：完整记忆闭环

```
用户对话
    │
    ├── 每条消息 → raw_messages (自增ID + 链表)
    │
    ├── 每 30 条 → LLM 摘要 → embedding (sqlite-vec vec0)
    │              → memory_snapshots + memory_embeddings
    │
    ├── 每次对话后 → cleanupCheckpoints(1) 清理旧快照
    │
    └── Agent 回忆 → search_memories (KNN / 时间)
                     → fetch_raw_messages (原文)
```
agent.invoke({ messages }, { configurable: { thread_id: 'companion' } })
    │
    ▼
LangGraph 每步自动保存 checkpoint → companion.db
    │
    ▼
上下文超阈值 → SummarizationMiddleware 自动摘要 → 替换旧消息
    │
    ▼
对话永不断线，上下文永不爆炸
```

关键设计决策：
- **一条线程用到底**：`thread_id = 'companion'` 固定，整个应用生命周期只有这一条持续对话
- **Checkpoint 是记忆主力**：管对话续接和状态持久化
- **树状记忆是辅助**：Agent 主动调工具回忆历史，不是每轮被动注入
- **一个文件 = 整个大脑**：所有数据在 `userData/companion/companion.db`，换设备就拷这个文件夹

## 三层"记忆"的最终定位

| | `memory` 参数 (AGENTS.md) | Checkpoint | 树状记忆 |
|---|---|---|---|
| **是什么** | 启动注入的人设文件 | 对话状态完整快照 | 历史索引 + 聚合 |
| **加载方式** | 全量注入 | 框架自动 | Agent 工具调用 |
| **存储** | 磁盘文件 | companion.db | companion.db（同文件不同表） |
| **管什么** | "你是谁" | "刚才聊了啥" | "半年前聊过啥" |
| **状态** | 📋 规划中 | ✅ 已实现 | 📋 规划中 |
