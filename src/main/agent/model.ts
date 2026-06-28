import { ChatOpenAI } from '@langchain/openai'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ModelProvider } from '../../shared/types'
// import { tokenLogger } from './utils/token-logger'

// 模型创建参数
export interface ModelConfig {
  provider: ModelProvider
  apiKey: string
  model: string
  baseURL?: string
  temperature?: number
  modelKwargs?:any
}

// 根据用户配置创建模型实例，屏蔽不同供应商的创建差异
export function createModel(config: ModelConfig): ChatOpenAI | ChatDeepSeek {
  const { provider, apiKey, model, baseURL, temperature = 0.7 } = config

  switch (provider) {
    case 'deepseek': {
      const m = new ChatDeepSeek({
        apiKey,
        model,
        temperature,
        // callbacks: [tokenLogger],  // 诊断开启
        modelKwargs: {
          // 禁用思考模式，否则 tool_choice 会冲突报 400
          thinking: { type: "disabled" }
        }
      })
      // 压低 maxInputTokens，让摘要中间件按此计算触发阈值
      // DeepSeek 默认 1M → 80% 永远不触发
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const realProfile = (m as any).profile
      Object.defineProperty(m, 'profile', {
        get: () => ({ ...realProfile, maxInputTokens: 50000}),
        configurable: true,
      })
      return m
    }

    case 'qwen':
    default: {
      const m = new ChatOpenAI({
        apiKey,
        model,
        temperature,
        // callbacks: [tokenLogger],  // 诊断开启
        ...(baseURL ? { configuration: { baseURL } } : {}),
      })
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const realProfile = (m as any).profile
      Object.defineProperty(m, 'profile', {
        get: () => ({ ...realProfile, maxInputTokens: 50000 }),
        configurable: true,
      })
      return m
    }
  }
}
