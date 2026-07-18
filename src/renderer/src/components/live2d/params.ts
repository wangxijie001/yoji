/**
 * Live2D 动作组合配置
 * - 参数常量（Alexia 专属）+ 情绪定义（表情 + 动态行为）
 * - 纯数据，无副作用
 */

// ---- 类型 ----

export interface ParamOverride {
  id: string
  value: number
}

export type ParamPreset = Record<string, number>

/** 行为函数：每帧调用，接收本帧时间信息，直接写 coreModel 参数 */
export type BehaviorFn = (ctx: {
  coreModel: { setParameterValueById(id: string, value: number, weight?: number): void }
  elapsed: number   // 从行为启动开始的累计秒数
  dt: number         // 本帧秒数
}) => void

/** 一个情绪 = 一组静态表情参数 + 一个可选动态行为 */
export interface EmotionDef {
  params: ParamPreset
  behavior?: BehaviorFn
}

export type EmotionMap = Record<string, EmotionDef>

// ---- Alexia 模型专属参数名 ----

export const ALEXIA = {
  '墨镜': 'Param11', '眼镜': 'Param64', '衣服': 'Param16', '衣服托帽子': 'Param17',
  '问号': 'Param43', '汗': 'Param44', '咧嘴笑': 'Param54', '星星眼': 'Param55',
  '晕': 'Param56', '生气': 'Param57', '脸红': 'Param58', '哭': 'Param59',
  '叼棍': 'Param60',
  '抱胸': 'Param61',
  '头X': 'ParamAngleX', '头Y': 'ParamAngleY', '头Z': 'ParamAngleZ',
  '身体X': 'ParamBodyAngleX', '身体Y': 'ParamBodyAngleY', '身体Z': 'ParamBodyAngleZ',
  '左眼开闭': 'ParamEyeLOpen', '右眼开闭': 'ParamEyeROpen',
  '左眼微笑': 'ParamEyeLSmile', '右眼微笑': 'ParamEyeRSmile',
  '挤眼1': 'Param51', '挤眼2': 'Param52',
  '嘴巴开合': 'ParamMouthOpenY', '嘴变形': 'ParamMouthForm', '歪嘴': 'Param20',
  '吐舌': 'Param46', '鼓脸': 'Param21', '撅嘴': 'Param48', '嘟嘴': 'Param45',
  '用力挤嘴': 'Param47', '嘴巴宽': 'Param49', '下巴': 'Param50',
  '眉上下': 'ParamBrowLY', '眉变形': 'ParamBrowLForm',
  '眼球X': 'ParamEyeBallX', '眼球Y': 'ParamEyeBallY', '呼吸': 'ParamBreath'
} as const

export const BASE_PARAMS = {
  MOUTH: ['ParamMouthOpenY'] as string[],
  BLINK: ['ParamEyeLOpen', 'ParamEyeROpen'] as string[],
  BREATH: ['ParamBreath'] as string[]
}

// ---- 16 情绪：表情 + 行为 ----

export const 情绪: EmotionMap = {

  // ═══ 正面高唤醒 ═══
  '开心': {
    params: { 星星眼: 30, 嘴变形: 1, 左眼微笑: 1, 右眼微笑: 1 },
    behavior: ({ coreModel, elapsed }) => {
      // 身体缓慢左右轻摇（跟兴奋同路线 ParamBodyAngleZ，只是慢很多）
      const sway = Math.sin(elapsed * 4) * 3
      coreModel.setParameterValueById('ParamBodyAngleZ', sway, 1)
      coreModel.setParameterValueById('ParamAngleZ', sway * 0.5, 1)
    }
  },

  '兴奋': {
    params: { 星星眼: 30,嘴变形: 1, 左眼微笑: 1, 右眼微笑: 1, 身体Z: 5 },
    behavior: ({ coreModel, elapsed }) => {
      // 快速身体摇晃 → 物理系统带动尾巴/耳朵/头发猛甩
      const shake = Math.sin(elapsed * 8) * 6
      coreModel.setParameterValueById('ParamBodyAngleZ', shake, 1)
      coreModel.setParameterValueById('ParamAngleZ', shake * 0.7, 0.5)
    }
  },

  '期待': {
    params: { 星星眼: 30, 左眼微笑: 1, 右眼微笑: 1, 头Z: 8 },
    behavior: ({ coreModel, elapsed }) => {
      const shake = Math.sin(elapsed * 5) * 6
      coreModel.setParameterValueById('ParamBodyAngleZ', shake, 1)
      coreModel.setParameterValueById('ParamAngleZ', shake * 0.7, 0.5)
    }
  },

  // ═══ 正面低唤醒 ═══
  '安心': {
    params: { 左眼微笑: 0.5, 右眼微笑: 0.5, 左眼开闭: 0.9, 右眼开闭: 0.9 },
    // 不做额外行为，靠底图层呼吸
  },

  '平静': {
    params: { 左眼微笑: 0.3, 右眼微笑: 0.3 },
  },

  // ═══ 中性/好奇 ═══
  '好奇': {
    params: { 问号: 30, 头Z: 10 },
    behavior: ({ coreModel, elapsed }) => {
      // 缓慢歪头向左再向右
      const tilt = Math.sin(elapsed * 1.2) * 8
      coreModel.setParameterValueById('ParamAngleZ', tilt, 0.5)
    }
  },

  // ═══ 社交情绪 ═══
  '害羞': {
    params: { 脸红: 30,头Y: -10 },
    behavior: ({ coreModel, elapsed }) => {
      // 身体微微内收 + 偶尔侧身
      const lean = Math.sin(elapsed * 1.8) * 3
      coreModel.setParameterValueById('ParamBodyAngleX', lean, 0.4)
    }
  },

  // ═══ 负面低唤醒 ═══
  '孤独': {
    params: { 头Y: 10, 眉上下: 0.5, 左眼开闭: 0.6, 右眼开闭: 0.6 },
    behavior: ({ coreModel, elapsed }) => {
      // 缓慢低头抬头
      const droop = Math.sin(elapsed * 0.8) * 4 + 4
      coreModel.setParameterValueById('ParamAngleY', droop, 0.3)
    }
  },

  '失落': {
    params: { 哭: 15, 头Y: 10, 眉上下: 1, 左眼开闭: 0.7, 右眼开闭: 0.7 },
    behavior: ({ coreModel, elapsed }) => {
      // 偶尔叹气式身体起伏
      const sigh = Math.sin(elapsed * 0.6) * 3
      coreModel.setParameterValueById('ParamBodyAngleY', sigh, 0.3)
      // 微微颤抖
      const tremble = Math.sin(elapsed * 12) * 0.5
      coreModel.setParameterValueById('ParamAngleX', tremble, 0.2)
    }
  },

  '悲伤': {
    params: { 哭: 30, 头Y: 10, 眉上下: 1, 左眼开闭: 0.3, 右眼开闭: 0.3 },
    behavior: ({ coreModel, elapsed }) => {
      // 抽泣节奏：每 2 秒一次身体抖动
      const cycle = elapsed % 2
      const sob = cycle < 0.3 ? Math.sin(cycle / 0.3 * Math.PI) * 5 : 0
      coreModel.setParameterValueById('ParamBodyAngleY', sob, 0.8)
      coreModel.setParameterValueById('ParamAngleY', sob * 0.6, 0.5)
      // 持续微颤
      const tremble = Math.sin(elapsed * 15) * 0.8
      coreModel.setParameterValueById('ParamBodyAngleX', tremble, 0.2)
    }
  },

  '心疼': {
    params: { 哭: 15, 头Y: 8, 眉上下: 1, 眉变形: 1 },
    behavior: ({ coreModel, elapsed }) => {
      // 缓慢歪头（心疼状）
      const tilt = Math.sin(elapsed * 1.5) * 5
      coreModel.setParameterValueById('ParamAngleZ', tilt, 0.4)
    }
  },

  // ═══ 负面高唤醒 ═══
  '烦躁': {
    params: { 生气: 30, 汗: 30, 叼棍: 30, 抱胸: 30, 歪嘴: 1, 眉变形: 1 },
    behavior: ({ coreModel, elapsed }) => {
      // 快速小幅度抖动（坐立不安）
      const fidget = Math.sin(elapsed * 10) * 3
      coreModel.setParameterValueById('ParamBodyAngleX', fidget, 0.4)
      coreModel.setParameterValueById('ParamAngleX', Math.sin(elapsed * 7) * 2, 0.3)
    }
  },

  '愤怒': {
    params: { 生气: 30, 汗: 30, 抱胸: 30, 眉变形: 1, 嘴变形: -1, 头X: 12, 歪嘴: 1, 左眼开闭: 0.6, 右眼开闭: 0.6 },
    behavior: ({ coreModel, elapsed }) => {
      // 身体明显颤抖
      const tremor = Math.sin(elapsed * 12) * 4
      coreModel.setParameterValueById('ParamBodyAngleX', tremor, 0.6)
      coreModel.setParameterValueById('ParamAngleX', tremor * 0.5, 0.4)
      // 呼吸急促感：身体 Y 轴快速起伏
      const pant = Math.abs(Math.sin(elapsed * 5)) * 4
      coreModel.setParameterValueById('ParamBodyAngleY', pant, 0.4)
    }
  },

  '忧虑': {
    params: { 汗: 30, 眉变形: 1, 头Z: -8 },
    behavior: ({ coreModel, elapsed }) => {
      // 不安地左右小幅度晃动
      const sway = Math.sin(elapsed * 3) * 4
      coreModel.setParameterValueById('ParamAngleZ', sway, 0.4)
      coreModel.setParameterValueById('ParamBodyAngleX', Math.sin(elapsed * 6) * 2, 0.3)
    }
  },

  // ═══ 其他负面 ═══
  '委屈': {
    params: { 鼓脸: 1, 嘟嘴: 1, 眉变形: 1, 头Y: -5, 左眼开闭: 0.7, 右眼开闭: 0.7 },
    behavior: ({ coreModel, elapsed }) => {
      // 微微低头 + 偶尔侧眼（委屈状）
      const pout = Math.sin(elapsed * 1.5) * 3
      coreModel.setParameterValueById('ParamAngleY', pout, 0.3)
      coreModel.setParameterValueById('ParamAngleZ', Math.sin(elapsed * 2) * 4, 0.3)
    }
  },

  '疲惫': {
    params: { 左眼开闭: 0, 右眼开闭: 0 },
    behavior: ({ coreModel, elapsed }) => {
      const nod = Math.sin(elapsed * 0.7) * 5 + 3
      coreModel.setParameterValueById('ParamAngleY', nod, 0.4)
      coreModel.setParameterValueById('ParamBodyAngleY', Math.sin(elapsed * 0.7) * 3, 0.3)
      coreModel.setParameterValueById('ParamMouthOpenY', 0.8, 1)
    }
  },
}

// ---- 工具 ----

/** 所有情绪用到的参数中文名（构建重置表用） */
export const EMOTION_PARAM_NAMES = new Set(
  Object.values(情绪).flatMap((def) => Object.keys(def.params))
)

/** blink 管线专管，情绪不碰 */
const _blinkParams = new Set(['ParamEyeLOpen', 'ParamEyeROpen', '左眼开闭', '右眼开闭'])

/** 切换情绪时的复位快照 */
export const EMOTION_RESET_MAP: ParamOverride[] = [...EMOTION_PARAM_NAMES]
  .filter((cn) => {
    const id = ALEXIA[cn as keyof typeof ALEXIA] ?? cn
    return !_blinkParams.has(cn) && !_blinkParams.has(id)
  })
  .map((cn) => ({ id: ALEXIA[cn as keyof typeof ALEXIA] ?? cn, value: 0 }))

export function resolvePreset(preset: ParamPreset): ParamOverride[] {
  return Object.entries(preset).map(([k, v]) => ({
    id: (ALEXIA as Record<string, string>)[k] ?? k,
    value: v
  }))
}
