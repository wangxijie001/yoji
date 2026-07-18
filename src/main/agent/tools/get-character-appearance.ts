import { tool } from 'langchain'
import { z } from 'zod'
import { getCurrentEmotionLog } from '../emotion/schema'
import type { EmotionState } from '../../../shared/types'

interface EmotionRow extends EmotionState {
  id: number
  display?: string
}

// ---- 外观描述 ----

/** 日间形象（6:00 - 21:00） */
const dayAppearanceMap = `银白色长发高侧马尾，刘海自然垂落遮额，头顶一根呆毛翘起。白色猫耳，耳内淡粉色。白色毛茸长尾，尾尖微弯。琥珀色/金橙色眼睛。
黑色紧身短袖T恤（露腰），多层银色项链带十字架吊坠。黑色露指手套，手腕银色手链。黑色低腰束脚工装裤，白色抽绳，口袋金属扣环拉链装饰。黑白高帮运动鞋。
气质可爱又充满活力，银发兽耳萌感 + 全黑机能风酷劲。`

/** 夜间形象（21:00 - 次日 6:00） */
const nightAppearanceMap = `银白色短发，刘海整齐覆额。深红色圆瞳，表情温和。戴浅蓝色猫耳连体帽（耳内白色）。灰白相间毛绒尾巴，自然弯曲垂落。
浅蓝色连体睡衣，胸前大面积白色区域印浅蓝色猫爪印。灯笼袖，袖口裤脚收紧。浅蓝色软底拖鞋。
气质温柔慵懒，居家治愈感。`

// ---- 情绪 → 表情/动作描述 ----

const EXPRESSION_MAP: Record<string, string> = {
  '开心': '眼睛好像有星星眼闪闪发光，嘴角弯弯翘起，身体轻轻左右摇摆',
  '兴奋': '眼睛好像有星星眼闪烁，身体快速摇晃，尾巴和耳朵猛烈摆动',
  '期待': '眼睛好像有星星眼亮晶晶，身体微微前倾，头左右张望，快速眨眼',
  '安心': '眼睛微微眯起，带着淡淡笑意，放松自然',
  '平静': '表情平静温和，眼睛微微带笑',
  '好奇': '头顶挂着问号，头歪向一侧',
  '害羞': '脸红了，低着头不敢直视，身体微微内收',
  '孤独': '低垂着头，眼神黯淡',
  '烦躁': '额头冒汗，嘴里叼着东西，双手抱胸，歪着嘴，身体坐立不安地抖动',
  '疲惫': '眼睛闭着，头像打瞌睡一样一点一点',
  '失落': '眼角带泪，低头叹气，微微颤抖',
  '委屈': '鼓着脸颊嘟着小嘴，眼睛微睁，低着头',
  '悲伤': '泪水流淌，低着头，身体偶尔抽泣抖动',
  '愤怒': '额头冒汗，双手抱胸，嘴向下弯，眼睛怒目微闭，身体明显颤抖',
  '忧虑': '额头冒汗，歪着头，不安地左右晃动',
  '心疼': '眼角含泪，歪着头'
}

/** 根据时间和装扮逻辑判断完整外观 */
function getOutfitAppearance(): string {
  const hour = new Date().getHours()

  // 6-9：正常，无眼镜
  if (hour >= 6 && hour < 9) {
    return `当前形象：${dayAppearanceMap}`
  }
  // 9-11：墨镜戴头上
  else if (hour >= 9 && hour < 11) {
    return `当前穿搭：${dayAppearanceMap}，墨镜带在头上`
  }
  // 11-13：墨镜戴脸上（中午太阳刺眼）
  else if (hour >= 11 && hour < 13) {
    return `当前穿搭：${dayAppearanceMap}，墨镜正常带在脸上，中午的太阳刺眼`
  }
  // 13-16：墨镜戴头上
  else if (hour >= 13 && hour < 16) {
    return `当前穿搭：${dayAppearanceMap}，墨镜带在头上`
  }
  // 16-21：正常，无眼镜
  else if (hour >= 16 && hour < 21) {
    return `当前穿搭：${dayAppearanceMap}`
  }
  // 21-23：正常，无眼镜
  else if (hour >= 21 && hour < 23) {
    return `当前穿搭：${nightAppearanceMap},睡衣的帽子还没带上，但是随时准备去睡觉`
  }
  // 21·-6：睡衣 + 猫耳帽
  else {
    return `当前穿搭：${nightAppearanceMap},睡衣的帽子已经带上，似乎已经进入列梦乡`
  }
}

export const getCharacterAppearance = tool(
  async () => {
    try {
      const outfit = getOutfitAppearance()

      // 尝试获取当前情绪表情
      const rows = getCurrentEmotionLog(1)
      let expression = ''
      if (rows.length > 0) {
        const latest = rows[0] as EmotionRow
        if (latest.display) {
          try {
            const display = JSON.parse(latest.display)
            const primary: string = display.primary || ''
            expression = EXPRESSION_MAP[primary] || ''
          } catch {
            /* 解析失败就用空表情 */
          }
        }
      }

      const emotionLine = expression ? `\n此刻：${expression}。` : ''
      return `【你的虚拟形象】\n${outfit}${emotionLine}`
    } catch (error) {
      return `获取形象状态失败: ${error}`
    }
  },
  {
    name: 'get_character_appearance',
    description:
      '当用户询问你的形象外观 或 其它需要你的形象外观状态描述信息时调用此工具。返回完整的角色外观描述 + 当前的表情和动作。',
    schema: z.object({})
  }
)
