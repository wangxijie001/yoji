# 主动聊天系统

## 设计理念

AI 不应该只是被动回应用户——当用户长时间不发言时，AI 应该能主动发起对话。主动聊天系统通过**递增间隔定时器** + **情绪系统联动**实现这一能力。

核心思路：
- 定时器间隔随时间翻倍（10min → 20min → 40min → ...），上限 12 小时
- 每次触发时读取用户最后一条消息的时间，计算沉默时长
- 构造情绪提示注入 AI，引导 AI 主动与用户互动
- 用户手动发消息自动重置定时器

---

## 架构

```
用户发消息 → agent:chat:stream IPC → 主进程 chatStream()
                                        ↓
                                  changeEmotion() 完成后
                                        ↓
                                  写入 latestUserMessage 到 env.json
                                        ↓
渲染进程 sendMessage() 完成后
        ↓
proactiveChat.resetTimer() ← 重置定时器，从 10 分钟重新开始


定时器触发（渲染进程）
        ↓
onTickChat() → 读取 env.json 中 latestUserMessage
        ↓
计算 last_chat_time_span = (now - createdAt) / 60 分钟
        ↓
构造 aiMessage = "用户已经 X 分钟没有和你聊天了..."
        ↓
调用 _callback({assistantMessage: aiMessage})
        ↓
sendMessage() → agentApi.chatStream() → 正常流式对话流程
        ↓
AI 回复显示在聊天界面
```

### 为什么定时器放在渲染进程

定时器运行在渲染进程（`src/renderer/src/pages/ai-chat/proactive-chat.ts`），而非主进程：

- 窗口打开时定时器运行，窗口关闭后进程销毁，定时器自动停止
- AI 不会在用户关闭窗口后在后台自言自语
- 重新打开窗口时 `useEffect` 初始化重新启动定时器

---

## 核心文件

| 文件 | 作用 |
|---|---|
| `src/renderer/src/pages/ai-chat/proactive-chat.ts` | 定时器管理 + 主动消息构造 |
| `src/renderer/src/pages/ai-chat/AIChat.tsx` | UI 集成：初始化、开关 toggle、sendMessage 回调 |
| `src/main/agent/index.ts` (line ~241) | `changeEmotion` 完成后写入 `latestUserMessage` |
| `src/main/agent/emotion/index.ts` | 情绪系统读取 `latestUserMessage` 计算时间间隔 |

---

## 定时器逻辑

### 状态管理

```ts
const INITIAL_INTERVAL_MS = 10 * 60 * 1000  // 10 分钟
const MAX_INTERVAL_MS = 12 * 60 * 60 * 1000  // 12 小时

let currentIntervalMs: number       // 当前间隔，每次触发后翻倍
let timeoutId: NodeJS.Timeout|null  // 当前 setTimeout 引用
let systemProactiveChatEnabled: boolean  // 系统配置缓存
let _callback: Callback|null        // 触发时的回调（sendMessage）
```

### 间隔序列

| 触发次数 | 间隔 | 累计时间 |
|---|---|---|
| 1 | 10 分钟 | 0h 10m |
| 2 | 20 分钟 | 0h 30m |
| 3 | 40 分钟 | 1h 10m |
| 4 | 80 分钟 | 2h 30m |
| 5 | 160 分钟 | 5h 10m |
| 6 | 320 分钟 | 10h 30m |
| 7 | 640 分钟（10.7h） | 21h 10m |
| 8 | 1280 分钟（21.3h）→ 超过 12h，停止 | — |

### API

| 函数 | 说明 |
|---|---|
| `initProactiveConfig(callback, setIsProactiveChatUISwitch)` | 初始化：注册回调 + 读取配置 + 启动定时器 |
| `resetTimer(isProactiveChatEnabled?)` | 重置定时器到 10min。传 `true` 时同步写入配置 |
| `stopTimer(isProactiveChatEnabled?)` | 停止并清理。传 `true` 时写入配置关闭 |

---

## 消息流

### 主动消息构造

```ts
// proactive-chat.ts - onTickChat()
const lastUserMsg = await envConfig.get('latestUserMessage')
const minutesSinceLastChat = (Date.now() - lastUserMsg.createdAt) / 1000 / 60
const aiMessage = `我是你的情绪助手：用户已经 ${minutesSinceLastChat} 分钟没有和你聊天了，你应该主动与用户互动一下`
_callback({ assistantMessage: aiMessage })
```

### sendMessage 的分支处理

```ts
// AIChat.tsx - sendMessage()
if (assistantMessage) {
    // 主动聊天路径：只添加 AI 消息到列表，不显示用户消息
    setMessageList((prev) => [...prev, aiMessage])
    chatMessageList = [{ role: "assistant", content: userMsg }]
} else {
    // 用户聊天路径：同时添加用户消息 + AI 消息
    setMessageList((prev) => [...prev, userMessage, aiMessage])
    chatMessageList = [{ role: "user", content: userMsg }]
}

// 只有用户主动发消息才重置定时器
if (!assistantMessage) {
    proactiveChat.resetTimer()
}
```

### 主动消息的角色

主动消息以 `role: "assistant"` 发送到主进程，被转为 `AIMessage`：

- `userMessage` 为空 → 不记录到聊天历史（避免历史被系统提示污染）
- AI 正常看到并处理该消息，生成回复
- AI 的回复正常记录到历史

---

## latestUserMessage 写入时机

```
chatStream() 流程：
  1. insertMessageHistory({role:'user', content: userMessage})  // 写入数据库
  2. agent.stream()                                               // 流式对话
  3. insertMessageHistory({role:'assistant', content: totalMessages})
  4. changeEmotion([...])                                         // 情绪分析（读取上次的 latestUserMessage）
        .finally(() => {
            envConfig.set('latestUserMessage', {                  // 情绪完成后才更新
                createdAt: Date.now(),
                content: userMessage
            })
        })
```

**关键设计**：`latestUserMessage` 在 `changeEmotion` 完成后才更新。因为情绪系统需要读取**上一次**用户消息来计算时间间隔，如果提前更新就会读到本条消息本身，导致 `last_chat_time_span ≈ 0`。

---

## 用户开关

UI 通过 `isProactiveChatEnabled` 状态 + 图标按钮控制：

```tsx
// AIChat.tsx
const changeProactiveChatEnabled = (enabled: boolean) => {
    setIsProactiveChatEnabled(enabled)
    if (enabled) {
        proactiveChat.resetTimer(true)   // 开启：重置 + 写入配置
    } else {
        proactiveChat.stopTimer(true)    // 关闭：停止 + 写入配置
    }
}
```

配置持久化在 `env.json` 的 `isProactiveChatEnabled` 字段，下次启动时通过 `initProactiveConfig` 读取恢复状态。

---

## 与情绪系统的联动

1. 定时器触发 → `onTickChat()` 计算沉默时长
2. 构造情绪提示 → `_callback()` → `sendMessage()` → `chatStream()`
3. `chatStream` 末尾自动调 `changeEmotion()`
4. `changeEmotion()` 从 `latestUserMessage` 读取时间间隔 → LLM 分析情绪变化
5. 情绪更新后广播 `emotion:updated` → 渲染进程更新背景

这样每次主动聊天都会触发一次完整的情绪更新周期，AI 的情绪随时间和环境自然演化。

---

## 后续扩展

- **主动消息差异化**：根据时间段（早上/下午/深夜）构造不同的提示文本
- **情绪驱动触发**：不仅基于时间，也可在情绪大幅波动时主动触发
- **用户活跃度学习**：根据用户历史聊天频率动态调整初始间隔
