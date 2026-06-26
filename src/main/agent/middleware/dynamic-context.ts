/**
 * 动态上下文注入 Middleware
 *
 * 从 config.context 读取不入历史的临时消息，注入到模型对话中。
 * 当前用于情绪注入，后续可扩展其他临时上下文（用户位置、天气等）。
 *
 * 用法：
 *   createDeepAgent({ contextSchema, middleware: [dynamicContext] })
 *   agent.stream(input, { ...threadConfig, context: { emotion: '幸福、放松' } })
 */

import { createMiddleware, SystemMessage } from 'langchain'


// 1. 定义动态注入中间件
export const dynamicContext = createMiddleware({
  name: "dynamicContext",
    wrapModelCall: (request, handler) => {
    // 1. 获取需要注入的动态信息
       // @ts-ignore
    const dynamicInfo = `你当前的情绪:${request.runtime?.context?.emotion || '未知'}`
    const _systemMessage = new SystemMessage(dynamicInfo )

    // 2. 构造新的消息列表
    const messages = [
      ...request.messages,
      _systemMessage
    ];

    // 3. 直接创建一个新的请求配置对象，覆盖 messages 属性
    // 注意：我们将原有的 request 属性展开，覆盖掉 messages
    return handler({
      ...request,
      messages
    });
  }
});
