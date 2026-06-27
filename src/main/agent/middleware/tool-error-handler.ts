import { createMiddleware, ToolMessage } from 'langchain'

/**
 * 工具调用容错 Middleware
 *
 * 当工具因参数校验失败抛出 ToolInvocationError 时，
 * 将其转为 error ToolMessage，Agent 可看到错误并修正参数重试。
 * 避免工具调用失败导致的对话中断。
 */
export const toolErrorHandler = createMiddleware({
  name: 'toolErrorHandler',
  wrapToolCall: async (request, handler) => {
    try {
      return await handler(request)
    } catch (err) {
      const msg = err instanceof Error ? err.message.split('\n')[0] : String(err)
      return new ToolMessage({
        name: request.toolCall.name ?? 'unknown',
        content: `调用失败: ${msg}。请检查参数后重试。`,
        tool_call_id: request.toolCall.id ?? '',
      })
    }
  },
})
