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

## 异步子代理（deepagents v1.9.0+，preview）

v1.9.0 重构了异步子代理机制，新增 `AsyncSubAgent` 类型和 `AsyncSubAgentMiddleware`，提供完整的后台任务生命周期管理。

### 对比

| 维度 | 同步子代理 | 异步子代理 |
|---|---|---|
| 执行模型 | 主代理阻塞等待完成 | 立即返回 job ID，主代理继续 |
| 并发 | 并行但阻塞 | 并行且非阻塞 |
| 中途指令 | 不支持 | `update_async_task` 发送新指令 |
| 取消 | 不支持 | `cancel_async_task` 取消任务 |
| 状态管理 | 无状态 | 有状态（独立线程维护） |

### 配置

```ts
import { createDeepAgent, AsyncSubAgent } from "deepagents"

const asyncSubagents: AsyncSubAgent[] = [
  {
    name: "researcher",
    description: "Research agent for information gathering and synthesis",
    graphId: "researcher",
    // 不设 url → ASGI transport（同进程内调用）
  },
  {
    name: "coder",
    description: "Coding agent for code generation and review",
    graphId: "coder",
    url: "https://coder-deployment.langsmith.dev", // HTTP transport（远程）
  },
]

const agent = createDeepAgent({
  model: "...",
  subagents: [...asyncSubagents],
})
```

### 新增的 5 个工具

`AsyncSubAgentMiddleware` 在主代理上注入以下工具：

| 工具 | 作用 |
|---|---|
| `start_async_task` | 启动后台任务，立即返回 Task ID |
| `check_async_task` | 查看任务当前状态和结果 |
| `update_async_task` | 向运行中的任务发送新指令 |
| `cancel_async_task` | 停止运行中的任务 |
| `list_async_tasks` | 列出所有被跟踪的任务及实时状态 |

### 传输方式

| 方式 | 说明 |
|---|---|
| **ASGI Transport**（同进程） | 函数调用，零网络延迟。两个 graph 注册在同一个 `langgraph.json` 中 |
| **HTTP Transport**（远程） | 通过网络调用远程 Agent Protocol 服务器，适合独立扩展 |
| **Hybrid** | 混合同进程和远程子代理 |

### 状态管理

任务元数据存储在 supervisor graph 的专用 state channel（`asyncTasks`）中，与消息历史分离。这确保 task ID 在上下文压缩/摘要后依然存活。每条任务记录：task ID、agent name、thread ID、run ID、status、timestamps。

### 典型交互流程

```
用户: 帮我分析这 50 个文件
  → 主 Agent 调用 start_async_task("coder", ...)
    → 返回 task_001
  → 主 Agent: "已启动后台任务 task_001，我先陪你聊天，完了通知你"
  
  [用户可以继续聊天...]

  → 用户: "那个文件分析完了吗？"
  → 主 Agent 调用 check_async_task("task_001")
    → 返回: { status: "running", progress: "12/50 files done" }
  → 主 Agent: "还在跑，已经分析了 12 个文件"

  [过一会儿...]

  → check_async_task("task_001")
    → 返回: { status: "completed", result: "..." }
  → 主 Agent: "分析完了！结果如下..."
```

## 权限

子代理默认继承父代理的文件系统权限，也可单独声明读写规则。
