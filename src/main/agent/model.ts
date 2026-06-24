import { ChatOpenAI } from '@langchain/openai'
import { ChatDeepSeek } from '@langchain/deepseek'
import { ModelProvider } from '../../shared/types'

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
    case 'deepseek':
      return new ChatDeepSeek({
        apiKey,
        model,
        temperature,
         modelKwargs: {
            // 关键：显式禁用思考模式
            thinking: { type: "disabled" }
          }
      })

    case 'qwen':
    default:
      return new ChatOpenAI({
        apiKey,
        model,
        temperature,
        ...(baseURL ? { configuration: { baseURL } } : {}),
      })
  }
}
