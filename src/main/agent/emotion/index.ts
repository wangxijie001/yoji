import { getCurrentEmotion, insertEmotion } from './schema'
import { broadcast } from '../../ipc/broadcast'
import { queryMessagesHistory } from '../utils/chat-history'
import { getWeather } from '../utils/weather'
import { analyzeEmotion } from './emotion_model'
import dayjs from 'dayjs'
import { EmotionState } from '../../../shared/types'

// 当前情绪
let currentEmotion:string = '状态平稳'
// 获取当前情绪描述
export const getCurrentEmotionInfo = () => currentEmotion

// 激素变化步长：反映每种激素的自然波动幅度
// 兴奋类波动快、压力类快速积累、信任类缓慢变化、节律类幅度大
export type Incretion = 'dopamine' | 'serotonin' | 'gaba' | 'cortisol' | 'adrenaline' | 'oxytocin' | 'endorphin'| 'melatonin'
// type IncretionParams = {
//   name: string
//   heigh: number
//   mid: number
//   low: number
//   max: number
//   min: number
// }

// const incretion_step: Record<Incretion, IncretionParams> = {
//   dopamine: { name: '多巴胺', heigh: 6, mid: 4, low: 2, max: 100, min: 0 }, // 兴奋/好奇
//   serotonin: { name: '血清素', heigh: 4, mid: 2, low: 1, max: 100, min: 0 }, // 心理满足
//   gaba: { name: 'GABA', heigh: 4, mid: 2, low: 1, max: 100, min: 0 }, // 身体松弛
//   cortisol: { name: '皮质醇', heigh: 5, mid: 3, low: 1, max: 100, min: 0 }, // 压力积累
//   adrenaline: { name: '肾上腺素', heigh: 8, mid: 5, low: 2, max: 100, min: 0 }, // 瞬时应激
//   oxytocin: { name: '催产素', heigh: 4, mid: 3, low: 2, max: 100, min: 0 }, // 信任依恋
//   endorphin: { name: '内啡肽', heigh: 5, mid: 3, low: 1, max: 100, min: 0 }, // 愉悦舒适
//   melatonin: { name: '褪黑素', heigh: 50, mid: 30, low: 10, max: 100, min: 0 } // 昼夜节律
// }

//上一次查询天气的时间戳
let get_weather_at = 0
// 上一次查询天气的描述
let last_weather_description = ''

export async function changeEmotion(message: { role: string; content: string }[]) {
  const current = getCurrentEmotion()
  if (!current) return
  //当前情绪参数
  const {dopamine,serotonin, gaba, cortisol, adrenaline,oxytocin,endorphin,melatonin,source,
    emotion, description,created_at } = current
  const new_emotion = { dopamine,serotonin,gaba,cortisol,adrenaline,oxytocin,endorphin, melatonin,source, emotion, description,created_at }

  //时间影响逻辑
  const latest = queryMessagesHistory(undefined, 3)
  const lastMsg = latest[0] ?? null
  const now = Date.now() // 当前时间戳
  let last_chat_time_span = '' //上次聊天的时间间隔
  let weather_info: string = '' //天气信息
  let current_time = '' //当前时间

  if (lastMsg) {
    const { created_at: lastMsgCreatedAt } = lastMsg
    get_weather_at = get_weather_at || lastMsgCreatedAt
    // 距上次聊天的时间
    const minutesSinceLastChat = (now - lastMsgCreatedAt) / 1000 / 60 // 转换为分钟
    last_chat_time_span = `${minutesSinceLastChat.toFixed(2)}分钟`
  }
  // 天气影响逻辑：每 30 分钟查询一次
  const minutesSinceWeather = (now - get_weather_at) / 1000 / 60
  if (minutesSinceWeather >= 30) {
    get_weather_at = now
    try {
      const res = await getWeather()
      if (typeof res === 'string') throw new Error(res) // API 错误
      // 组装天气中文描述
      const current_weather_description = [
        `天气：${res.weather}`,
        `温度：${res.temperature}°C`,
        `湿度：${res.humidity}%`,
        `风力：${res.wind_direction}${res.wind_power}`
      ].join('，')

      weather_info = `
            30分钟前天气:${last_weather_description || '未查询'},
            当前天气:${current_weather_description},
        `
      last_weather_description = current_weather_description
      current_time = `当前时间：${dayjs(now).format('YYYY-MM-DD HH:mm:ss')}`
    } catch {
      /* 查询失败跳过 */
    }
  }

  const current_message = message
    .map((item) => {
      return `${item.role === 'user' ? '用户' : 'ai伴侣'}：${item.content}`
    })
    .join('\n')

  const result = await analyzeEmotion({
    current: new_emotion,
    current_time,
    weather_info,
    last_chat_time_span,
    last_messages: current_message
  })

  if (!result) return

  // 应用 delta 到当前激素水平，并钳位到 0–100
  const HORMONE_KEYS: Incretion[] = [
    'dopamine',
    'serotonin',
    'gaba',
    'cortisol',
    'adrenaline',
    'oxytocin',
    'endorphin',
    'melatonin'
  ]
  const next: EmotionState = { ...new_emotion }
  for (const key of HORMONE_KEYS) {
    next[key] = result.delta[key] || 50
  }
  next.source = result.source || 'chat'
  next.emotion = result.emotion
  next.display = JSON.stringify(result.display)
  next.description = result.description
  // 更新当前情绪描述
  currentEmotion = result.emotion
  insertEmotion(next)
  broadcast('emotion:updated', next)
}
