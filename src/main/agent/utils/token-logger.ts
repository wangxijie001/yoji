import { BaseCallbackHandler } from '@langchain/core/callbacks/base'
import type { Serialized } from '@langchain/core/load/serializable'
import type { LLMResult } from '@langchain/core/outputs'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import { app } from 'electron'

/**
 * 缓存命中率统计工具
 *
 * 拦截模型调用，记录每次请求的 token 用量和缓存命中率到文件。
 * 用法：model.ts 创建模型时加上 callbacks: [tokenLogger]
 * 日志：userData/companion/prompt-logs/cache-stats.jsonl
 */

const LOG_DIR = join(app.getPath('userData'), 'companion', 'prompt-logs')
mkdirSync(LOG_DIR, { recursive: true })

class TokenLogger extends BaseCallbackHandler {
  name = 'TokenLogger'

  async handleLLMStart(
    _llm: Serialized,
    _prompts: string[],
    _runId: string,
    _parentRunId?: string,
    _extraParams?: Record<string, unknown>,
    _tags?: string[],
    _metadata?: Record<string, unknown>,
  ): Promise<void> {
    // 诊断完整上下文时取消注释
    // const timestamp = Date.now()
    // const totalChars = _prompts.reduce((sum, p) => sum + p.length, 0)
    // const tools = (_extraParams as any)?.invocation_params?.tools ?? []
    // const file = join(LOG_DIR, `prompt-${timestamp}.json`)
    // writeFileSync(file, JSON.stringify({ ... }, null, 2), 'utf-8')
  }

  async handleLLMEnd(
    output: LLMResult,
    _runId: string,
    _parentRunId?: string,
  ): Promise<void> {
    let usage: any = null

    // 优先从消息 response_metadata 取，否则从 llmOutput 取
    const message = (output.generations[0]?.[0] as any)?.message
    if (message?.response_metadata?.usage) {
      usage = message.response_metadata.usage
    }
    if (!usage && output.llmOutput) {
      const raw = output.llmOutput as any
      usage = raw?.usage || raw?.tokenUsage
    }
    if (!usage) return

    const inputTokens: number = usage.prompt_tokens ?? usage.promptTokens ?? 0
    const outputTokens: number = usage.completion_tokens ?? usage.completionTokens ?? 0
    const cacheHit: number = usage.prompt_cache_hit_tokens || 0
    const cacheMiss: number = usage.prompt_cache_miss_tokens ?? (inputTokens - cacheHit)
    const hitRate = inputTokens > 0 ? ((cacheHit / inputTokens) * 100).toFixed(1) : '0.0'

    console.log(`[TokenLogger] 输入 ${inputTokens}t | 缓存命中 ${cacheHit}t (${hitRate}%) | 未命中 ${cacheMiss}t | 输出 ${outputTokens}t`)

    appendFileSync(join(LOG_DIR, 'cache-stats.jsonl'), JSON.stringify({
      time: new Date().toISOString(),
      input: inputTokens,
      hit: cacheHit,
      miss: cacheMiss,
      rate: `${hitRate}%`,
      output: outputTokens,
    }) + '\n', 'utf-8')
  }
}

export const tokenLogger = new TokenLogger()
