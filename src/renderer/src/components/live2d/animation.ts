/**
 * Live2D 动画逻辑 — 纯函数，无 React 依赖
 * - 口型/呼吸/眨眼/待机兜底/情绪(表情+行为)/参数覆盖
 */
import type { Live2DModel } from 'pixi-live2d-display/cubism4'
import type { ParamOverride, EmotionDef } from './params'
import { BASE_PARAMS, EMOTION_RESET_MAP, 情绪, resolvePreset } from './params'

// ---- TS 桥接 ----

interface CoreModelAPI {
  setParameterValueById(id: string, value: number, weight?: number): void
}
interface InternalModelAPI {
  on(event: string, fn: () => void): void
  settings: { groups?: { Name: string; Ids: string[] }[] }
  coreModel: CoreModelAPI
}

// ---- 装扮（时间段自动切换，不跟情绪绑定）----

export function createAccessoryAnimator(model: Live2DModel): () => void {
  const m = model as unknown as { internalModel: InternalModelAPI }
  const tick = (): void => {
    const hour = new Date().getHours()
    if (hour >= 6 && hour < 9) {
      m.internalModel.coreModel.setParameterValueById('Param11', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    } else if (hour >= 9 && hour < 11) {
      m.internalModel.coreModel.setParameterValueById('Param11', 30, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    } else if (hour >= 11 && hour < 13) {
      m.internalModel.coreModel.setParameterValueById('Param64', 30, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    } else if (hour >= 13 && hour < 16) {
      m.internalModel.coreModel.setParameterValueById('Param11', 30, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    } else if (hour >= 16 && hour < 21) {
      m.internalModel.coreModel.setParameterValueById('Param11', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    } else if (hour >= 21 && hour < 23) {
      m.internalModel.coreModel.setParameterValueById('Param11', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 30, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 30, 1)
    } else {
      m.internalModel.coreModel.setParameterValueById('Param11', 0, 1)
      m.internalModel.coreModel.setParameterValueById('Param16', 30, 1)
      m.internalModel.coreModel.setParameterValueById('Param17', 0, 1)
    }
  }
  m.internalModel.on('beforeModelUpdate', tick)
  return () => {}
}

// ---- 疲惫打哈欠（跟在 emotion 后面、talking 前面注册）----

export function createYawnAnimator(
  model: Live2DModel,
  isActive: () => boolean
): () => void {
  const m = model as unknown as { internalModel: InternalModelAPI }
  const start = performance.now()
  const tick = (): void => {
    if (!isActive()) return
    const t = (performance.now() - start) / 1000
    const mouth = 0.3 + Math.abs(Math.sin(t * 0.5)) * 0.3
    m.internalModel.coreModel.setParameterValueById('ParamMouthOpenY', mouth, 1)
  }
  m.internalModel.on('beforeModelUpdate', tick)
  return () => {}
}

// ---- 点击映射 ----

export function setupHitHandler(model: Live2DModel): void {
  const m = model as unknown as {
    settings: { motions?: Record<string, unknown[]> }
    on(event: string, fn: (hitAreas: string[]) => void): void
  }
  m.on('hit', (hitAreas) => {
    const groups = Object.keys(m.settings.motions ?? {})
    for (const area of hitAreas) {
      const matched = groups.find(
        (g) => g.toLowerCase().includes('tap') && g.toLowerCase().includes(area.toLowerCase())
      )
      if (matched) {
        model.motion(matched)
        return
      }
    }
    const fallback = groups.find((g) => g.toLowerCase().startsWith('tap'))
    if (fallback) model.motion(fallback)
  })
}

// ---- 说话口型 ----

export function getLipSyncIds(model: Live2DModel): string[] {
  const m = model as unknown as { internalModel: InternalModelAPI }
  return (
    m.internalModel.settings.groups?.find((g) => g.Name === 'LipSync')?.Ids ?? [
      ...BASE_PARAMS.MOUTH
    ]
  )
}

export function createTalkingAnimator(
  model: Live2DModel,
  lipSyncIds: string[],
  isTalking: () => boolean
): () => void {
  const m = model as unknown as { internalModel: InternalModelAPI }
  const s = { v: 0, t: 0, sw: 0 }
  const tick = (): void => {
    if (isTalking()) {
      const n = performance.now()
      if (n - s.sw > 80 + Math.random() * 80) {
        s.sw = n
        s.t = 0.3 + Math.random() * 0.7
      }
      s.v += (s.t - s.v) * 0.35
    } else if (s.v > 0.01) {
      s.v *= 0.75
    } else {
      return
    }
    lipSyncIds.forEach((id) => m.internalModel.coreModel.setParameterValueById(id, s.v, 1))
  }
  m.internalModel.on('beforeModelUpdate', tick)
  return () => {
    s.v = 0
    s.t = 0
  }
}

// ---- 呼吸 ----

export function createBreathAnimator(model: Live2DModel): () => void {
  const m = model as unknown as { internalModel: InternalModelAPI }
  const start = performance.now()
  const tick = (): void => {
    const t = ((performance.now() - start) % 4000) / 4000
    m.internalModel.coreModel.setParameterValueById(
      'ParamBreath',
      0.5 + 0.5 * Math.sin(t * Math.PI * 2),
      1
    )
    m.internalModel.coreModel.setParameterValueById(
      'ParamBodyAngleX',
      Math.sin(t * Math.PI * 2) * 2,
      0.5
    )
    m.internalModel.coreModel.setParameterValueById(
      'ParamAngleZ',
      Math.sin(t * Math.PI * 2) * 3,
      0.5
    )
  }
  m.internalModel.on('beforeModelUpdate', tick)
  return () => {}
}

// ---- 眨眼 ----

export function createBlinkAnimator(
  model: Live2DModel,
  getBlinkInterval: () => number = () => 2000 + Math.random() * 3000
): () => void {
  const m = model as unknown as { internalModel: InternalModelAPI }
  let phase: 'open' | 'closing' | 'hold' | 'opening' = 'open',
    ps = performance.now(),
    nb = ps + getBlinkInterval()
  const tick = (): void => {
    const n = performance.now(),
      e = n - ps
    switch (phase) {
      case 'open':
        if (n >= nb) {
          phase = 'closing'
          ps = n
        }
        break
      case 'closing': {
        const p = Math.min(e / 60, 1)
        m.internalModel.coreModel.setParameterValueById('ParamEyeLOpen', 1 - p, 1)
        m.internalModel.coreModel.setParameterValueById('ParamEyeROpen', 1 - p, 1)
        if (p >= 1) {
          phase = 'hold'
          ps = n
        }
        break
      }
      case 'hold':
        m.internalModel.coreModel.setParameterValueById('ParamEyeLOpen', 0, 1)
        m.internalModel.coreModel.setParameterValueById('ParamEyeROpen', 0, 1)
        if (e >= 40) {
          phase = 'opening'
          ps = n
        }
        break
      case 'opening': {
        const p = Math.min(e / 150, 1)
        m.internalModel.coreModel.setParameterValueById('ParamEyeLOpen', p, 1)
        m.internalModel.coreModel.setParameterValueById('ParamEyeROpen', p, 1)
        if (p >= 1) {
          phase = 'open'
          ps = n
          nb = n + getBlinkInterval()
        }
        break
      }
    }
  }
  m.internalModel.on('beforeModelUpdate', tick)
  return () => {}
}

// ---- 情绪动画器（静态 params 平滑过渡 + 动态 behavior 每帧执行）----

/**
 * 统一情绪管线：静态表情参数平滑插值 + 动态身体行为持续运行。
 * 返回 { setEmotion } 用于切换情绪。
 */
export function createEmotionAnimator(model: Live2DModel): {
  setEmotion: (name: string | null) => void
} {
  const m = model as unknown as { internalModel: InternalModelAPI }
  const core = m.internalModel.coreModel

  // —— 静态参数平滑 ——
  const SPEED = 0.12
  const current = new Map<string, number>()
  const target = new Map<string, number>()

  // —— 动态行为 ——
  let behavior: EmotionDef['behavior'] | null = null
  let behaviorStart = performance.now()

  const tick = (): void => {
    // 静态参数插值
    for (const [id, tVal] of target) {
      const cVal = current.get(id) ?? 0
      const diff = tVal - cVal
      if (Math.abs(diff) < 0.003) {
        current.set(id, tVal)
      } else {
        current.set(id, cVal + diff * SPEED)
      }
      core.setParameterValueById(id, current.get(id)!, 1)
    }
    for (const [id, cVal] of current) {
      if (!target.has(id) && Math.abs(cVal) < 0.003) current.delete(id)
    }

    // 动态行为
    if (behavior) {
      behavior({ coreModel: core, elapsed: (performance.now() - behaviorStart) / 1000, dt: 1 / 60 })
    }
  }
  m.internalModel.on('beforeModelUpdate', tick)

  return {
    setEmotion: (name: string | null): void => {
      const def: EmotionDef | undefined = name
        ? (情绪 as Record<string, EmotionDef>)[name]
        : undefined
      // 静态参数
      target.clear()
      const overrides = def
        ? [...EMOTION_RESET_MAP, ...resolvePreset(def.params)]
        : [...EMOTION_RESET_MAP]
      for (const { id, value } of overrides) {
        target.set(id, value)
        if (!current.has(id)) current.set(id, 0)
      }
      // 动态行为
      behavior = def?.behavior ?? null
      behaviorStart = performance.now()
    }
  }
}

// ---- 保留：供外部获取情绪覆盖参数 ----

export function getEmotionOverride(name: string): ParamOverride[] {
  const def = (情绪 as Record<string, EmotionDef>)[name]
  return def ? [...EMOTION_RESET_MAP, ...resolvePreset(def.params)] : []
}

// ---- 戳一戳 ----

export type PokeArea = string

export const POKE_FEEDBACKS: Record<string, ParamOverride[]> = {
  ear: [
    { id: 'ParamAngleY', value: -10 },
    { id: 'Param58', value: 30 },
    { id: 'ParamEyeLSmile', value: 1 },
    { id: 'ParamEyeRSmile', value: 1 }
  ],
  head: [
    { id: 'ParamAngleY', value: -15 },
    { id: 'Param58', value: 30 },
    { id: 'ParamEyeLSmile', value: 1 },
    { id: 'ParamEyeRSmile', value: 1 }
  ],
  face: [
    { id: 'ParamAngleY', value: -8 },
    { id: 'Param58', value: 30 },
    { id: 'ParamEyeLOpen', value: 0.3 },
    { id: 'ParamEyeROpen', value: 0.3 }
  ],
  chest: [
    { id: 'ParamBodyAngleY', value: -5 },
    { id: 'Param58', value: 20 },
    { id: 'ParamAngleY', value: -5 }
  ],
  belly: [
    { id: 'ParamBodyAngleZ', value: 15 },
    { id: 'ParamAngleY', value: -3 },
    { id: 'ParamEyeLSmile', value: 1 },
    { id: 'ParamEyeRSmile', value: 1 }
  ],
  arm: [
    { id: 'ParamBodyAngleX', value: 10 },
    { id: 'ParamAngleZ', value: 8 },
    { id: 'ParamEyeLSmile', value: 0.8 }
  ],
  hand: [
    { id: 'ParamAngleY', value: -5 },
    { id: 'Param58', value: 20 },
    { id: 'ParamEyeLSmile', value: 1 },
    { id: 'ParamEyeRSmile', value: 1 }
  ],
  leg: [
    { id: 'ParamBodyAngleZ', value: 12 },
    { id: 'ParamAngleY', value: -5 },
    { id: 'ParamEyeLSmile', value: 0.8 },
    { id: 'ParamEyeRSmile', value: 0.8 }
  ],
  foot: [
    { id: 'ParamBodyAngleZ', value: 8 },
    { id: 'ParamAngleY', value: -8 },
    { id: 'ParamEyeLSmile', value: 1 }
  ],
  tail: [
    { id: 'ParamBodyAngleZ', value: 15 },
    { id: 'ParamAngleZ', value: 5 },
    { id: 'ParamEyeLSmile', value: 0.8 },
    { id: 'ParamEyeRSmile', value: 0.8 }
  ]
}
