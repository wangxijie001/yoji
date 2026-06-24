# DeepAgents 流式输出

## 基本用法

```ts
for await (const event of await agent.stream({
  messages: [{ role: 'user', content: '...' }],
})) {
  // 处理事件
}
```

## 事件类型

| 事件 | 内容 |
|---|---|
| `messages` | LLM 输出的消息流 |
| `tool_calls` | 工具调用开始/进行中/完成 |
| `subagents` | 子代理状态变化 |
| `values` | State 值变更 |
| `custom` | 自定义事件 |

## 对接 IPC

主进程流式输出 → IPC 逐个事件推给渲染进程：

```ts
// 主进程
ipcMain.handle('agent:stream', async (event, { messages }) => {
  for await (const chunk of await agent.stream({ messages })) {
    event.sender.send('agent:chunk', chunk)
  }
  event.sender.send('agent:done')
})

// 渲染进程
window.electron.ipcRenderer.on('agent:chunk', (_, chunk) => {
  appendToChat(chunk)  // 打字机效果
})
```
