# 异步子 Agent 调度系统

## 设计理念

官方 deepagents 的 `SubAgent` 通过 `task` 工具同步调用，主 Agent 阻塞等待。`AsyncSubAgent`（v1.9.0+）依赖 Agent Protocol Server，本地 Electron 不适用。

我们自己实现一套纯本地的异步子 Agent 调度——本质是一个 **client/server 本地化实现**：taskPool 管理任务生命周期，子 Agent 临时创建、用完即弃，主 Agent 完全不阻塞。

## 架构

```
主 Agent（不变，thread: 'companion'）
  ├── 缓存单例 _agent、_checkpointer
  ├── 正常对话
  └── 工具: start_background_task / query_task_result

后台调度系统（src/main/agent/children-agent/async/）
  ├── taskQueue[]      — 待执行任务
  ├── runningTaskQueue  — 执行中任务
  ├── taskResultQueue[] — 待通知结果
  ├── cacheAgentMap     — Agent 实例池（MD5 缓存）
  └── eventLoop         — 100ms 定时轮询
```

### 执行流程

```
pushOneTask({ agentId, params })
  → taskQueue.push(task)
  → 触发 eventLoop

eventLoop（100ms 轮询）
  → 检查 runningTaskQueue.size < MAX(5)
  → 检查 agent 状态 free
  → taskQueue.shift() → executor(task)

executor
  → getChildAgent(agentId)   // 缓存命中 → 复用；未命中 → 创建
  → agent.invoke(params, thread_id)  // 独立 thread，不干扰主对话
  → 结果存 DB + push taskResultQueue
  → deleteThreadCheckpoints  // 用完即清
  → agent 标记 free

eventLoop 处理结果
  → broadcast('background:task:completed')
  → markTaskNotified
```

## 核心文件

| 文件 | 作用 |
|------|------|
| `src/main/agent/children-agent/async/index.ts` | 调度核心：任务队列、事件循环、执行器、Agent 缓存 |
| `src/main/agent/children-agent/async/tools.ts` | 异步任务工具：pushAsyncTask / cancelAsyncTask / getAsyncTaskAgent / getAsyncTaskResult |
| `src/main/agent/children-agent/async/task-result.ts` | 结果持久化：SQLite CRUD、过期清理 |
| `src/main/agent/mcp/index.ts` | MCP 连接管理：createMcpClient（PATH 合并）/ testConnection / saveMcpConfig |
| `src/main/agent/utils/checkpoint-cleaner.ts` | 新增 `deleteThreadCheckpoints(threadId)` |

## 并发模型

JS 单线程 + async I/O：子 Agent 的执行时间几乎全花在 `await` LLM / MCP HTTP 请求上，等待时事件循环释放线程处理其他任务。多个子 Agent 实际并发执行，互不阻塞。

```
Agent 1: invoke() → await LLM(5s) → await MCP(2s) → done
Agent 2:          invoke() → await LLM(3s) → done
Agent 3:                   invoke() → await LLM(8s) → await MCP(1s) → done
                                  ↑
                        真正的异步并发，共享 JS 事件循环
```

并发上限 `MAX_RUNNING_TASKS = 5`，超出排队。同一 agentId 不可重复执行（status 检查）。

## Agent 缓存策略

```
cacheAgentMap: { agentId → { agent, mcpClient, md5, status } }

创建 Agent 前：
  → 计算 MD5(version + MCP 版本号拼接)
  → 命中 → 复用 Agent + MCP 连接
  → 未命中 → 关闭旧 client → 新建 client → getTools → createAgent → 缓存
```

Agent 类型通过 `agent-list.ts` 注册，可无限扩展。每个类型绑定不同的 MCP 工具子集。

## Checkpoint 处理

每次任务使用独立的 UUID `thread_id`，复用主 Agent 的 `SqliteSaver`（WAL 模式安全并发）。任务完成后 `deleteThreadCheckpoints` 清空该 thread 的所有 checkpoint 数据，不留垃圾。

## 任务取消

`Task` 类型携带 `abortController?: AbortController`，入队时不赋值，执行前创建。通过 `AbortSignal` 中断 `agent.invoke()` 中正在进行的 LLM 网络请求，实现异步任务的中途取消：

```
cancelTask(taskId)
  → 排队中 → taskQueue.splice(idx, 1) 直接移除
  → 执行中 → task.abortController.abort()
    → invoke() 内部 fetch 收到 abort 事件
    → 抛出 AbortError → executor 清理
```

- 取消后释放 Agent 槽位（`status: 'free'`）
- 清理独立 thread 的 checkpoint
- 结果推入 `taskResultQueue`，广播 `background:task:completed`
- 主 Agent 可通过 `abort_async_task` 工具取消
- UI 通过 `task:queryQueue` / `task:cancel` IPC 展示和操作

## IPC 通知

| 通道 | 方向 | 用途 |
|------|------|------|
| `background:task:completed` | 主 → 渲染 | 任务完成/取消通知 `{ taskId, result }` |
| `task:queryQueue` | 渲染 → 主 | 查询当前排队 + 执行中的任务列表 |
| `task:cancel` | 渲染 → 主 | 手动取消指定 taskId 的异步任务 |

渲染进程通过 `window.api.agent.onBackgroundTaskCompleted(callback)` 监听，回调返回取消订阅函数。

## 官方 async subagent 对比

| 维度 | 官方 AsyncSubAgent | 我们的实现 |
|------|-------------------|-----------|
| 依赖 | Agent Protocol Server（LangSmith/自托管） | 无，纯本地 |
| 传输 | HTTP (`@langchain/langgraph-sdk`) | 函数调用 |
| 子 Agent 类型 | 注册到 `langgraph.json` 的 graph | `agent-list.ts` 任意配置 |
| 通知 | Server callback | broadcast IPC |
| 适合场景 | 云端/自托管 Server | Electron / Node.js 本地 |
