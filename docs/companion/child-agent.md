# 子 Agent 系统

## 概述

主 Agent 通过子 Agent 系统将任务委派给专业化的小 Agent。用户在「工坊」页面创建配置，所有变更通过 `agentVersion` 统一触发 Agent 重建。

子 Agent 分为两类：

| 类型 | 调用方式 | 是否阻塞 | 适用场景 |
|------|---------|---------|---------|
| 同步 Agent | 主 Agent `task` 工具 | ✅ 等待返回 | 读写文件、执行命令、MCP 调用 |
| 异步 Agent | `push_async_task` 工具 | ❌ 后台执行 | 联网搜索、批量处理、定时任务 |

## 架构

```
工坊 UI (Workshop)
  ├── 新增 / 编辑 / 删除 / 启停 Agent
  ├── 配置 MCP 工具集
  └── 每次变更 → updateAgentVersion()

createAgent()
  ├── 检测 agentVersion 变化 → 触发重建
  ├── createSyncSubAgents()      → SubAgent[] 注入 deepagents
  ├── getAllAgentDesc('async')   → 写入 system prompt
  ├── getAllAgentDesc('sync')    → 写入 system prompt
  └── buildSystemPrompt() 动态拼装

主 Agent
  ├── 查看 system prompt 中的子 Agent 列表
  ├── task(sync-agent-id, prompt)       → 同步委派
  └── push_async_task(async-agent-id)   → 异步派发
```

## 同步 Agent（`src/main/agent/children-agent/sync/`）

```
所有同步 Agent
  → 收集 mcpList，按 key 去重
  → 单一 MultiServerMCPClient 连接所有 MCP
  → getTools() 获取全部工具，按 serverKey 预分组 → Map<key, tools[]>
  → 每个 Agent 按 mcpList[].key 取值组装 SubAgent
```

关键设计：
- **单一 MCP 连接**：所有同步 Agent 共享一个 `MultiServerMCPClient`，减少连接开销
- **工具精准分发**：`prefixToolNameWithServerName: true`，工具名 `serverKey__toolName`，按 Agent 的 `mcpList[].key` 匹配
- **无 MCP 也能用**：Agent 没配 MCP 工具也能正常创建（纯 LLM Agent）
- **连接超时 15s**：MCP 连接失败不影响其他 Agent 创建

## 异步 Agent（`src/main/agent/async-children-agent/`）

独立于主 Agent graph 的调度系统：

```
主 Agent push_async_task({ agentId, params })
  → taskQueue.push(task) → eventLoop 唤醒

eventLoop（100ms 轮询）
  → MAX_RUNNING = 5
  → executor → getAgent(agentId) → invoke()
  → 结果存 DB → broadcast('background:task:completed')
```

详见 [async-child-agent.md](async-child-agent.md)。

## agentVersion 机制

所有需要 Agent 重建的配置变更统一走 `agentVersion`（UUID 值）：

| 触发源 | 位置 |
|--------|------|
| 模型切换 / 保存 | `ModalSet.tsx` |
| MCP 启用 / 保存 / 卸载 | `McpManage.tsx` |
| 工坊新增 / 编辑 / 删除 / 启停 | `Workshop.tsx` |

```
变更 → agentApi.updateVersion() → env.json agentVersion 更新
createAgent() → getAgentVersion() → 对比缓存 → 不匹配则重建
```

`createAgent()` 缓存逻辑简化为纯版本号对比，不再关心具体是哪种配置变了。

## 核心文件

| 文件 | 作用 |
|------|------|
| `src/main/agent/children-agent/sync/index.ts` | 同步 Agent 工厂：配置读取、MCP 连接、工具分发、SubAgent 组装 |
| `src/main/agent/children-agent/async/` | 异步 Agent 调度：队列、事件循环、执行器 |
| `src/main/agent/children-agent/agent-list.ts` | Agent 配置读写：getAgent / isAgentExist / getAllAgentDesc |
| `src/main/agent/system-prompt.ts` | buildSystemPrompt() 动态注入可用子 Agent 描述 |
| `src/main/agent/create-agent.ts` | createAgent() 缓存 + 重建入口 |
| `src/main/ipc/agent.ts` | getAgentVersion / updateAgentVersion + IPC 通道 |
| `src/renderer/src/pages/workshop/` | 工坊页面：Agent 管理 UI |

## 配置结构

```json
{
  "name": "网页抓取助手",
  "uuid": "4834f736-...",
  "isAsync": true,
  "isSystem": false,
  "description": "抓取网页内容并生成结构化描述",
  "systemPrompt": "你是一个网页抓取助手...",
  "mcpList": [
    {
      "key": "fetch-html-mcp",
      "uuid": "22ca840f-...",
      "name": "Fetch网页内容抓取"
    }
  ],
  "isEnabled": true
}
```
