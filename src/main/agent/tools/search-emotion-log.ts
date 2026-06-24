import { tool } from 'langchain'
import { z } from 'zod'
import { getCurrentEmotionLog } from '../emotion/schema'
import dayjs from 'dayjs'
import { EmotionState } from '../../../shared/types'

interface EmotionRow extends EmotionState {
  id: number
}

function formatEmotionRow(r: EmotionRow, i: number): string {
  const hormoneSummary = [
    `多巴胺:${r.dopamine}`,
    `血清素:${r.serotonin}`,
    `GABA:${r.gaba}`,
    `皮质醇:${r.cortisol}`,
    `肾上腺:${r.adrenaline}`,
    `催产素:${r.oxytocin}`,
    `内啡肽:${r.endorphin}`,
    `褪黑素:${r.melatonin}`
  ].join(' ')

  const time = dayjs(r.created_at).format('YYYY-MM-DD HH:mm:ss')

  return [
    `[${i + 1}] ${time}  id:${r.id}`,
    `  激素: ${hormoneSummary}`,
    `  来源: ${r.source ?? '-'}`,
    `  情绪: ${r.emotion}`,
    `  原因: ${r.description}`
  ].join('\n')
}

export const searchEmotionLog = tool(
  async ({ id }: { id?: number }) => {
    try {
      const rows = getCurrentEmotionLog(30, id)

      if (rows.length === 0) {
        return id !== undefined ? `未找到 id=${id} 及之前的情绪记录。` : '暂无情绪记录。'
      }

      return rows.map((r, i) => formatEmotionRow(r as EmotionRow, i)).join('\n\n')
    } catch (error) {
      return `查询情绪日志失败: ${error}`
    }
  },
  {
    name: 'search_emotion_log',
    description: `查询你的情绪变化日志。不传 id 返回最近30条记录，传 id 返回该条记录及之前共30条记录。每条记录包含8种激素水平、情绪描述、变化原因等信息。`,
    schema: z.object({
      id: z.number().optional().describe('指定记录ID，传入则返回该条及之前共30条记录')
    })
  }
)
