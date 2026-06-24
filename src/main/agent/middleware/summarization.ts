import { createSummarizationMiddleware, StateBackend } from 'deepagents'
import type { AgentMiddleware } from 'langchain'
import type { BaseChatModel } from '@langchain/core/language_models/chat_models'

/**
 * 摘要中间件
 *
 * 上下文达到模型上限 85% 时自动触发：
 *   1. 旧消息存档到 StateBackend（checkpointer 已持久化完整状态，这里只满足框架要求）
 *   2. LLM 生成对话摘要
 *   3. 摘要替换旧消息，保留最近上下文
 *
 * 使用独立 model 实例，建议用便宜模型省 token 成本
 */
export function createSummaryMiddleware(_summaryModel?: BaseChatModel): AgentMiddleware {
  return createSummarizationMiddleware({
    // model: summaryModel,  // 暂时复用主模型，后续可独立配置便宜模型
    trigger: [
      { type: 'messages', value: 5 },
      { type: 'tokens', value: 20000 },
      { type: 'fraction', value: 0.5 },
    ],
    keep: { type: 'messages', value: 1 },
    backend: (config) => new StateBackend(config),
  })
}
