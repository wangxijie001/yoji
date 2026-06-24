import { EmotionState, ModelConfig, ModelProvider } from '../../../shared/types'
import { getConfig } from '../../config'
import { createModel } from '../model'
import { z } from 'zod'
import { SystemMessage, HumanMessage } from '@langchain/core/messages'
import { emotionPrompt } from './emotion-prompt'
import type { Incretion } from './index'

// LLM 结构化输出：激素变化 + 情绪描述
const EmotionChangeSchema = z.object({
    description: z.string().describe('描述数值变化以及原因概括'),
  // 变化值（可为负）：多巴胺、血清素、GABA、皮质醇、肾上腺素、催产素、内啡肽、褪黑素
  delta: z
    .object({
      dopamine: z.number().describe('多巴胺'),
      serotonin: z.number().describe('血清素'),
      gaba: z.number().describe('GABA'),
      cortisol: z.number().describe('皮质醇'),
      adrenaline: z.number().describe('肾上腺素'),
      oxytocin: z.number().describe('催产素'),
      endorphin: z.number().describe('内啡肽'),
      melatonin: z.number().describe('褪黑素')
    })
    .describe('变化后的激素水平'),
  source: z.string().describe('情绪变化的来源可有多个值用“，”隔开  案例 “chat,weather,time”'),
  emotion: z.string().describe('当前情绪的文字描述，200字以内，用自然语言表达情绪状态'),
  display: z
    .object({
      primary: z.string().describe('主导情绪，从 "开心 | 期待 | 安心 | 平静 | 好奇 | 害羞 | 孤独 | 烦躁 | 疲惫 | 失落 | 委屈 | 悲伤 | 愤怒 | 忧虑 | 兴奋" 15个选项中各选一个'),
      secondary: z.string().describe('次要情绪，从上述选项中选择一个与主导不同的情绪')
    })
    .describe('驱动 UI 背景渐变的表情标签，不描述感受而是从候选集中选择最贴合的标签，兼顾主导和辅助情绪')
})

// 调用 LLM 分析情绪变化
export async function analyzeEmotion(params: {
  current: EmotionState
  current_time: string
  weather_info: string
  last_chat_time_span: string
  last_messages: string
}): Promise<{
  delta: Record<Incretion, number>
  source?: string
  emotion: string
  display: { primary: string; secondary: string; }
  description: string
} | null> {
  try {
    const activeProvider = getConfig('env').get('activeProvider') as ModelProvider
    const stored = getConfig('model').get(activeProvider) as ModelConfig

    const config = {
      apiKey: stored.apiKey,
      provider: activeProvider,
      model: stored.model,
      baseURL: stored.baseURL
    }

    const model = createModel({
      ...config,
      modelKwargs: { thinking: { type: 'disabled' } }
    })
    const structured = model.withStructuredOutput(EmotionChangeSchema)

    const result = await structured.invoke([
      new SystemMessage(emotionPrompt),
      new HumanMessage(`
            当前激素水平：
            多巴胺(${params.current.dopamine}) 血清素(${params.current.serotonin}) GABA(${params.current.gaba})
            皮质醇(${params.current.cortisol}) 肾上腺素(${params.current.adrenaline})
            催产素(${params.current.oxytocin}) 内啡肽(${params.current.endorphin}) 褪黑素(${params.current.melatonin})

            天气信息：${params.weather_info || '未获取'}
            当前时间：${params.current_time || '未获取'}

            距离上次对话时间间隔：${params.last_chat_time_span || '未获取'}
            最近一轮对话：${params.last_messages || '无'}`)
    ])

    return {
      delta: result.delta as Record<string, number>,
      emotion: result.emotion,
      display: result.display,
      description: result.description
    }
  } catch {
    return null
  }
}
