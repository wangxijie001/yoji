# 任务监控系统

## 设计理念

主对话和异步子 Agent 任务在执行过程中会产生大量中间状态（状态流转、工具调用、思考过程、增量输出）。为了让用户能实时看到"任务现在跑到哪一步了"，需要一个**统一的运行信息缓存**：谁在跑、跑什么、调了哪些工具、输出了什么。

关键点：**主对话与异步任务共用同一套缓存和同一套展示组件**——聊天页的运行日志、独立监控页看到的是同一份数据结构，只是来源前缀不同。

## 架构

```
写入方（主进程）
  ├── 主对话     src/main/agent/index.ts            → updateTaskRunningInfo('main:'  + id, patch)
  └── 异步任务   children-agent/async/index.ts      → updateTaskRunningInfo('async:' + id, patch)
                （handleStreamOutput 解析流式 chunk 后逐条写入）

缓存（主进程）
  src/main/agent/task-monitor/index.ts
  └── taskRunningInfoCache: Map<taskId, TaskRunningInfo>

查询出口
  queryTaskQueue(taskId?)
    → IPC 'agent:queryTaskQueue'  (src/main/ipc/agent.ts)
      → preload  agent.queryTaskQueue
        → renderer  agentApi.queryTaskQueue

展示（渲染进程）
  src/renderer/src/pages/task-monitor/
    ├── TaskMonitor.tsx           # 列表 2s 轮询 + 详情 1s 轮询
    └── components/
        ├── mainMessage.tsx       # 思考 + 主输出
        └── toolMessage.tsx       # 单条工具调用（name / params / content）
```

## 数据结构

`TaskRunningInfo`（定义在 `src/shared/types.ts`）：

```ts
type TaskRunningInfo = {
  taskId: string
  params: string
  agentId: string
  status: 'waiting' | 'running' | 'completed' | 'stopped' | 'failed'
  toolsMessage: { id: string; name: string; params: string; content: string }[]
  thinkMessage: string
  mainMessage: string
  createdAt: number | null
  endTime: number | null
}
```

## 核心 API

`src/main/agent/task-monitor/index.ts` 导出两个函数：

### updateTaskRunningInfo(taskId, patch)

增量写入，按字段类型区分合并策略：

| 场景 | 行为 |
|------|------|
| 缓存不存在（首次） | 整体替换，直接写入传入对象（首次必须带完整初始值） |
| `status` | 直接替换 |
| `toolsMessage` | 按 `id` upsert：不存在 → 补全缺省字段后 push；存在 → 合并替换该项 |
| `thinkMessage` | `+=` 拼接 |
| `mainMessage` | `+=` 拼接 |

> 入参类型 `TaskRunningInfoPatch`：顶层字段可选，`toolsMessage` 传**单个对象**（`id` 必填、其余可选，只传要改的字段），而缓存里存的是数组。

**引用直改，无需重新 set**：`Map.get()` 拿到的是对象引用，改属性即改到缓存里；只有首次"从无到有"才需要 `set`。

### queryTaskQueue(taskId?)

| 调用 | 返回 |
|------|------|
| 不传 taskId | `{ taskId, status }[]` —— 任务列表 |
| 传 taskId | 单任务完整详情，附 `agentName` / `agentDesc`（从 `childrenAgentConfig` 取）；查不到返回 `null` |

## taskId 前缀

同一份缓存承载两类任务，用前缀区分来源，避免 id 冲突：

- 主对话：`'main:' + uuid`
- 异步任务：`'async:' + uuid`

## 持久化与清理

任务进入**终态**（`completed` / `stopped` / `failed`）时：

1. 写入 `endTime`
2. 落盘到临时文件 `tasks/<taskId>.json`（`src/main/agent/utils/tem-file-manage`）
3. 延迟 **10s** 从内存缓存删除（留一个窗口给前端最后一次拉取）

`queryTaskQueue(taskId)` 内存查不到时**回落读临时文件**，保证已结束的任务仍可查看历史详情。

## 渲染层轮询

`TaskMonitor.tsx`：

- **列表**：`queryTaskQueue()` 每 2s 轮询一次
- **详情**：`queryTaskQueue(taskId)` 每 1s 轮询一次；命中终态时停止详情轮询
- 用 `useRef` 存定时器 + `listFinished` / `contentFinished` 标志位，**上一次查询未返回时不重复发起**，避免请求堆积

> ⚠️ 定时器回调里读 state 有闭包陷阱：`setInterval` 里闭包捕获的是首次渲染的 state。列表增量合并应基于"函数式更新"或 ref，而不是直接读 `taskList`。

## 独立窗口（browser-window）

监控页可以从主界面独立成一个单独窗口显示。

文件：`src/main/ipc/browser-window.ts`。

渲染进程 `window.api.browserWindow.open(url)` → 主进程新开一个**无框窗口**（配置对齐主窗口 `titleBarStyle: 'hidden'`，复用同一 preload）加载 `url`：

- `http(s)` 开头 → 当作外部网页直接 `loadURL`
- 其他（如 `/task-monitor`）→ 拼成 `#/路由`，走 HashRouter 加载应用内页面

要点：

- **拖拽**：无框窗口默认不可拖动，拖拽区由页面自己用 `-webkit-app-region: drag` 定义（顶部留出一条），交互元素记得 `no-drag`。
- **数据同步**：无需特殊处理。`broadcast` 用 `BrowserWindow.getAllWindows()` 发给所有窗口，新窗口自动收到 `background:task:completed` 等广播；首屏数据走 `queryTaskQueue` 主动拉一次即可。

## 核心文件

| 文件 | 作用 |
|------|------|
| `src/main/agent/task-monitor/index.ts` | 运行信息缓存：updateTaskRunningInfo / queryTaskQueue + 终态落盘清理 |
| `src/main/agent/index.ts` | 主对话流式处理中写入 `'main:'` 前缀任务 |
| `src/main/agent/children-agent/async/index.ts` | 异步任务 `handleStreamOutput` 写入 `'async:'` 前缀任务 |
| `src/main/agent/utils/tem-file-manage.ts` | 临时文件读写（终态任务落盘 / 回落读取） |
| `src/main/ipc/browser-window.ts` | `browserWindow:open` —— 额外开窗口加载指定地址/路由 |
| `src/renderer/src/pages/task-monitor/` | 监控页：列表 + 详情（mainMessage / toolMessage 组件） |
