# 记忆系统

AI 伴侣的记忆分为三层，各司其职。

## 三层架构

| 层 | 是什么 | 存储 | 状态 |
|---|---|---|---|
| **AGENTS.md** | 用户画像 + 主题索引，启动时全量注入 | `FilesystemBackend` → `companion/AGENTS.md` | ✅ 已实现 |
| **Checkpoint** | 对话状态完整快照，每次对话后保留最新 1 条 | `SqliteSaver` → `companion.db` | ✅ 已实现 |
| **树状记忆** | 对话摘要 + 向量化，Agent 主动搜索 | `better-sqlite3` + `sqlite-vec` → `companion.db` | ✅ 已实现 |

## 数据存储

一个文件 = 整个大脑：

```
userData/companion/
├── AGENTS.md            ← 用户画像，启动全量注入
├── companion.db         ← 所有数据
│   ├── raw_messages         ← 聊天记录（自增ID + 链表）
│   ├── memory_snapshots     ← 记忆摘要（每30条 → 1条）
│   ├── memory_embeddings    ← 向量索引（sqlite-vec vec0 虚拟表）
│   ├── checkpoints          ← 对话状态（SqliteSaver）
│   └── checkpoint_writes    ← 待处理写入
└── companion.db-wal / .db-shm
```

## 树状记忆流程

### 存储：每 30 条消息自动触发

```
raw_messages 积累到 30 条新消息
    │
    ▼
取最近 30 条 → 拼成对话文本 → LLM 结构化输出
    → { summary, tags }
    │
    ▼
generateEmbedding(summary) → 384 维 Float32Array
    │
    ▼
INSERT INTO memory_snapshots (元数据)
INSERT INTO memory_embeddings (向量，rowid 对齐)
```

实现文件：[src/main/agent/utils/chat-history.ts](../../src/main/agent/utils/chat-history.ts) `generateAndStoreSnapshot()`

### 检索：Agent 主动调用工具

```
Agent: "上次聊 Rust 是什么时候？"
    │
    ├── search_memories({ query: "Rust 学习" })
    │     → 向量化查询 → sqlite-vec KNN → top 3 摘要 + message_ids
    │
    └── fetch_raw_messages({ message_ids: [...] })
          → 原始对话内容 + 时间戳
```

实现文件：[src/main/agent/tools/search-memories.ts](../../src/main/agent/tools/search-memories.ts)

## 关键表结构

```sql
-- 聊天记录
raw_messages (id, session_id, role, content, prev_id, next_id, created_at)

-- 记忆摘要
memory_snapshots (id, message_end_id, message_ids, summary, tags, time_start, time_end)

-- 向量索引（sqlite-vec）
memory_embeddings (rowid = memory_snapshots.id, embedding FLOAT[384])
```

## 技术栈

| 组件 | 技术 | 说明 |
|---|---|---|
| 聊天存储 | `better-sqlite3` | 自增 ID + 链表，分页拉取 |
| 向量化 | `@xenova/transformers` | `all-MiniLM-L6-v2` 量化版，22MB，384 维 |
| 向量索引 | `sqlite-vec` | vec0 虚拟表，KNN 搜索，零额外依赖 |
| 摘要生成 | 用户配置的 LLM | `withStructuredOutput` 结构化输出 |
| 打包分发 | `extraResources` | 模型文件打进安装包，离线可用 |

## 设计决策

1. **Checkpoint 只保留 1 条**：我们只需要最新对话状态，不需要回溯历史。每次对话后自动清理。
2. **不自动注入记忆**：Agent 通过 `search_memories` 工具主动回忆，而不是每轮被动注入。更像人，更省 token。
3. **向量化用本地模型**：`all-MiniLM-L6-v2` ONNX 量化版，22MB，384 维。离线运行，不依赖外部 API。
4. **摘要用主模型**：暂时复用用户配置的聊天模型，后续可切便宜模型省钱。
5. **时间字段统一用毫秒时间戳**：所有数据库时间字段（`created_at`、`time_start`、`time_end`）存 `INTEGER` 毫秒时间戳。存储和比较直接用数字，避免时区和格式问题。展示时通过 `formatTimestamp()` 转为 `YYYY-MM-DD HH:mm` 给大模型看。
6. **一个文件导出**：`companion/` 文件夹拷走即完整迁移。
