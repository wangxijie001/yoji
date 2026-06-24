/**
 * 情绪 API——查询 AI 伴侣的情绪变化日志
 *
 * 用法：
 *   import { emotionApi } from '@renderer/api/emotion'
 *   const log = await emotionApi.getLog(30)
 */

import type { EmotionState } from '@shared/types'

const emotionApi = {
  /** 查询情绪日志，不传 id 返回最近 limit 条，传 id 返回该条及之前共 limit 条 */
  async getLog(limit: number, id?: number): Promise<EmotionState[]> {
    const res = await window.api.emotion.getLog(limit, id)
    if (!res.ok) {
      return []
    }
    return res.data ?? []
  },

  /** 监听情绪更新，返回取消订阅函数 */
  onUpdated: (callback: (emotion: EmotionState) => void) =>
    window.api.emotion.onUpdated(callback),
}

export default emotionApi
