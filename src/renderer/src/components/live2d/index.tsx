import * as PIXI from 'pixi.js'
import styles from './index.module.css'
import { install } from '@pixi/unsafe-eval'
import { useEffect, useRef } from 'react'
import type { CSSProperties } from 'react'
import { Live2DModel } from 'pixi-live2d-display/cubism4'
import { POKE_FEEDBACKS } from './animation'
import {
  setupHitHandler,
  getLipSyncIds,
  createTalkingAnimator,
  createBreathAnimator,
  createBlinkAnimator,
  createEmotionAnimator,
  createAccessoryAnimator,
  createYawnAnimator
} from './animation'

export type TouchType = 'ear' | 'head' | 'face' | 'chest' | 'belly' | 'conceal' | 'arm' | 'hand' | 'leg' | 'foot' | 'tail'
export type TouchEvent = ((type: TouchType) => void) | null
// CSP 不允许 unsafe-eval，pixi 默认用 new Function() 生成 shader，打上官方无 eval 补丁
install(PIXI)

// 用 pixi 的 Ticker 驱动模型更新（口型/物理/动作插值）；完整版 pixi.js 已自带 TickerPlugin
Live2DModel.registerTicker(PIXI.Ticker)

/** 默认模型：public/live2d/Alexia */
export const DEFAULT_MODEL_URL = new URL(
  'live2d/Alexia/Alexia.model3.json',
  document.baseURI
).href

export interface Live2DProps {
  modelUrl?: string
  className?: string
  style?: CSSProperties
  talking?: boolean
  emotion?: string | null
  onTouch?: TouchEvent
  onReady?: (model: Live2DModel) => void
}

const Live2D = ({
  modelUrl = DEFAULT_MODEL_URL,
  className,
  style,
  talking = false,
  emotion = null,
  onTouch = null,
  onReady
}: Live2DProps) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const onReadyRef = useRef(onReady)
  const talkingRef = useRef(talking)
  const emotionNameRef = useRef(emotion)
  const emotionCtrlRef = useRef<{ setEmotion: (name: string | null) => void } | null>(null)
  const modelRef = useRef<Live2DModel | null>(null)

  useEffect(() => {
    onReadyRef.current = onReady
    talkingRef.current = talking
    emotionNameRef.current = emotion
  })

  const handlePoke = (area: string): void => {
    const m = modelRef.current
  
    if(area){
      onTouch && onTouch(area as TouchType)
    }
    
    if (!m) return
    const feedback = POKE_FEEDBACKS[area] ?? POKE_FEEDBACKS['head']
    const started = performance.now()
    const internal = m.internalModel as unknown as {
      on(event: string, fn: () => void): void
      coreModel: { setParameterValueById(id: string, value: number, weight?: number): void }
    }
    const tick = (): void => {
      const elapsed = performance.now() - started
      if (elapsed > 600) return
      const alpha = Math.max(0, 1 - elapsed / 600)
      for (const { id, value } of feedback) {
        internal.coreModel.setParameterValueById(id, value * alpha, 1)
      }
    }
    internal.on('beforeModelUpdate', tick)
  }

  useEffect(() => {
    emotionCtrlRef.current?.setEmotion(emotion)
  }, [emotion])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let destroyed = false

    const app = new PIXI.Application({
      resizeTo: container,
      backgroundAlpha: 0,
      antialias: true,
      autoDensity: true,
      resolution: window.devicePixelRatio || 1
    })
    container.appendChild(app.view)

    let model: Live2DModel | null = null
    let stopTalking = (): void => {}
    let stopBreath = (): void => {}
    let stopBlink = (): void => {}
    let stopAccessory = (): void => {}
    let stopYawn = (): void => {}

    const fitModel = (): void => {
      const { clientWidth: w, clientHeight: h } = container
      if (!w || !h) return
      // PIXI v6 的 resizeTo 只监听 window resize，容器被 JS 改大小时需手动 resize renderer
      app.renderer.resize(w, h)
      if (!model) return
      model.scale.set(1)
      model.scale.set(Math.min(w / model.width, h / model.height))
      model.anchor.set(0.5, 0.5)
      model.position.set(w / 2, h / 2)
    }

    Live2DModel.from(modelUrl)
      .then((m) => {
        if (destroyed) {
          m.destroy()
          return
        }
        model = m
        modelRef.current = m
        app.stage.addChild(m)
        fitModel()

        // 注册顺序决定权重（后注册的覆盖前面的）：
        //   breath → emotion → blink → talking
        stopBreath = createBreathAnimator(m)
        stopAccessory = createAccessoryAnimator(m)
        emotionCtrlRef.current = createEmotionAnimator(m)
        emotionCtrlRef.current.setEmotion(emotion)
        stopBlink = createBlinkAnimator(m, () => {
          return emotionNameRef.current === '期待' ? 100 + Math.random() * 300 : 2000 + Math.random() * 3000
        })
        stopYawn = createYawnAnimator(m, () => emotionNameRef.current === '疲惫')
        stopTalking = createTalkingAnimator(m, getLipSyncIds(m), () => talkingRef.current)
        setupHitHandler(m)

        onReadyRef.current?.(m)
      })
      .catch((err) => {
        console.error('[Live2D] 模型加载失败:', err)
      })

    const observer = new ResizeObserver(fitModel)
    observer.observe(container)

    return () => {
      destroyed = true
      stopTalking()
      stopBreath()
      stopBlink()
      stopAccessory()
      stopYawn()
      observer.disconnect()
      app.destroy(true, { children: true, texture: true, baseTexture: true })
    }
  }, [modelUrl])

  return (
    <div className={styles.wrapper}>
      <div
        ref={containerRef}
        className={className}
        style={{ width: '100%', height: '100%', overflow: 'hidden', ...style }}
      />
      {/* //ear head face chest  belly arm hand  leg foot */}
      <div  className={styles.ear}  onClick={() => handlePoke('ear')}/>
      <div className={styles.head} onClick={() => handlePoke('head')}/>
      <div className={styles.face} onClick={() => handlePoke('face')}/>
      <div className={styles.chest} onClick={() => handlePoke('chest')}/>
      <div className={styles.belly} onClick={() => handlePoke('belly')}/>
      <div className={styles.conceal} onClick={() => handlePoke('conceal')}/>
      <div className={styles.armLeft} onClick={() => handlePoke('arm')}/>
      <div className={styles.armRight} onClick={() => handlePoke('arm')}/>
      <div className={styles.handLeft} onClick={() => handlePoke('hand')}/>
      <div className={styles.handRight} onClick={() => handlePoke('hand')}/>
      <div className={styles.legArea} onClick={() => handlePoke('leg')}/>
      <div className={styles.footArea} onClick={() => handlePoke('foot')}/>
      <div className={styles.tail} onClick={() => handlePoke('tail')}/>
    </div>
  )
}

export default Live2D
