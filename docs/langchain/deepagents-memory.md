# DeepAgents 记忆系统

> DeepAgents 里"Memory"对应两个不同机制：
> 1. `memory` 参数——启动时全量注入的 AGENTS.md 文件
> 2. 长期记忆——Agent 通过内置文件工具在对话中自行管理

---

## 一、Backend：虚拟文件系统

在理解记忆之前，必须先搞懂 Backend——它决定了 Agent 操作的文件"落在哪"。

### 三种 Backend

| Backend | 数据在哪 | 生命周期 | 适用场景 |
|---|---|---|---|
| `StateBackend` | 内存 | 线程结束销毁 | 临时草稿 |
| `FilesystemBackend` | **真实磁盘** | 永久 | Agent 文件落地到磁盘 |
| `StoreBackend` | LangGraph Store | 跨会话持久 | 云端/数据库存储 |
| `CompositeBackend` | 混合路由 | 按路径前缀分发 | 临时 + 持久混合 |

### FilesystemBackend（我们项目用的）

```ts
import { FilesystemBackend } from 'deepagents'

new FilesystemBackend({
  rootDir: '/path/to/companion/',   // 真实磁盘目录
  virtualMode: true,                 // 沙箱模式：只能访问 rootDir 内的文件
})
```

`virtualMode: true` 的核心行为：
- 虚拟路径 `/AGENTS.md` → 映射到 `rootDir/AGENTS.md`
- 禁止路径遍历（`..`、`~`），Agent 无法越界
- 不需要 `permissions` 额外限制

### memory 参数为什么需要 Backend 配合

`memory` 参数的加载链路：

```
createDeepAgent({ memory: ['/path/to/AGENTS.md'] })
    │
    ▼
MemoryMiddleware 启动
    │
    ▼
loadMemoryFromBackend(backend, '/path/to/AGENTS.md')
    │
    ▼
backend.read('/path/to/AGENTS.md')  → 转为 rootDir + /path/to/AGENTS.md
    │
    ▼
读磁盘文件 → 注入 system prompt
```

**关键教训**：`memory` 参数依赖 Backend 读取文件。如果用的是默认 `StateBackend`（内存），文件不存在于内存中，读取失败，Agent 看不到记忆内容，就会自己瞎编路径。

### 我们踩过的坑

1. **默认 StateBackend 读不到 memory 文件** → Agent 看不到 AGENTS.md，编了一个 `/home/user/projects/agent/AGENTS.md`
2. **换 FilesystemBackend 后路径不对** → 用了相对路径，框架拼出了 `companion/home/user/...` 的嵌套路径
3. **最终方案：全量绝对路径** → `memory: [AGENTS_MD_PATH]`，FilesystemBackend 能正确解析

---

## 二、`memory` 参数：启动注入的说明书文件

### 基本用法

```ts
const agent = createDeepAgent({
  model,
  backend: new FilesystemBackend({ rootDir: COMPANION_DIR, virtualMode: true }),
  memory: ['/absolute/path/to/AGENTS.md'],
})
```

`memory` 是 `string[]`。文件在 Agent 启动时**全量读入并注入到 system prompt**。

### 关键行为：全量注入

> Unlike skills, memory is **always injected** — there is no progressive disclosure.

| 对比 | `memory` 文件 | `skills` 文件 |
|---|---|---|
| 加载方式 | 启动时**全量注入** | 按需渐进式加载 |
| 内容定位 | "你是谁"、"记住什么" | "怎么做" |
| 大小 | **必须精简**，否则爆上下文 | 可以很长 |

### 注入格式

MemoryMiddleware 在 system prompt 中插入：

```
<agent_memory>
/path/to/AGENTS.md
# 用户画像
- 前端工程师，偏好 React + TypeScript
...
</agent_memory>

<memory_guidelines>
可以通过 edit_file 更新记忆...
</memory_guidelines>
```

### 中间件执行顺序

```
1. TodoListMiddleware
2. SkillsMiddleware
3. FilesystemMiddleware      ← 文件工具注册
4. SubAgentMiddleware
5. SummarizationMiddleware   ← 自动摘要
6. PatchToolCallsMiddleware
7. AnthropicPromptCachingMiddleware
8. MemoryMiddleware          ← 记忆注入（在这里加载 AGENTS.md）
9. HumanInTheLoopMiddleware
```

---

## 三、我们项目的使用方式

### 架构

```
createDeepAgent({
  backend: FilesystemBackend({ rootDir: COMPANION_DIR, virtualMode: true }),
  memory: [AGENTS_MD_PATH],
  checkpointer: SqliteSaver → companion.db,
})
```

│

### 数据流

```
启动时：
  MemoryMiddleware → backend.read(AGENTS_MD_PATH)
    → FilesystemBackend 解析 → 读磁盘文件
    → 全量注入 system prompt

对话中：
  Agent 学到新东西 → 调 edit_file(AGENTS_MD_PATH, ...)
    → FilesystemBackend 解析 → 写磁盘文件
    → 下次启动时自动注入更新后的内容
```

### 文件分布

```
userData/companion/
├── AGENTS.md              ← memory 参数加载，Agent 通过 edit_file 更新
├── companion.db           ← checkpoint + raw_messages + 树状记忆（同一个文件）
├── companion.db-wal       ← WAL 临时文件
└── companion.db-shm       ← WAL 临时文件
```

### 两层记忆的配合

| | `memory` 参数 (AGENTS.md) | 长期记忆 (raw_messages + 树状索引) |
|---|---|---|
| 内容 | 用户画像 + 主题记录 | 对话历史 + 摘要 + 聚合 |
| 加载方式 | 启动时全量注入 | 按需检索 |
| 大小 | ≤ 500 字 | 无限制 |
| 谁写 | Agent 通过 edit_file | 自动（L0 写入）+ Consolidation（聚合） |
| 状态 | ✅ 已实现 | 📋 规划中 |

---

## 四、参考资料

| 资源 | 链接 |
|---|---|
| Memory 官方文档 | https://docs.langchain.com/oss/javascript/deepagents/memory |
| CreateDeepAgentParams API | https://reference.langchain.com/javascript/deepagents/index/CreateDeepAgentParams |
| Backends 文档 | https://docs.langchain.com/oss/javascript/deepagents/backends |
| deepagentsjs 源码 | https://github.com/langchain-ai/deepagentsjs |
