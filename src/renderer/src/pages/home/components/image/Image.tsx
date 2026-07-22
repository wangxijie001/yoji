import { useState, useRef, useEffect, useCallback, memo } from 'react'
import styles from './Image.module.css'
import imageMark from '@renderer/assets/image/imageMark.png'
import { Live2D } from '@renderer/components'
import type { TouchType } from '@renderer/components/live2d'
import { bus } from '@renderer/shared/eventBus'

const MIN_SIZE = { width: 120, height: 120 }
const MAX_SIZE = { width: 600, height: 600 }
const INITIAL = { width: 260, height: 320, margin: 16 }

const Image = ({ emotion }: { emotion?: string }) => {
  const [pos, setPos] = useState(() => ({
    x: window.innerWidth - INITIAL.width - INITIAL.margin,
    y: INITIAL.margin
  }))
  const [size, setSize] = useState({ width: INITIAL.width, height: INITIAL.height })
  const [isOpen, setIsOpen] = useState(false)
  const [talking, setTalking] = useState(false)
  const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
  const resizeRef = useRef({ active: false, startX: 0, startY: 0, originW: 0, originH: 0 })

  const onDragStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
    },
    [pos]
  )

  const onResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      resizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, originW: size.width, originH: size.height }
    },
    [size]
  )

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (dragRef.current.active) {
        setPos({
          x: Math.max(0, Math.min(dragRef.current.originX + (e.clientX - dragRef.current.startX), window.innerWidth - size.width)),
          y: Math.max(0, Math.min(dragRef.current.originY + (e.clientY - dragRef.current.startY), window.innerHeight - size.height))
        })
      }
      if (resizeRef.current.active) {
        const dw = resizeRef.current.originW + (e.clientX - resizeRef.current.startX)
        const dh = resizeRef.current.originH + (e.clientY - resizeRef.current.startY)
        setSize({ width: Math.max(MIN_SIZE.width, Math.min(dw, MAX_SIZE.width)), height: Math.max(MIN_SIZE.height, Math.min(dh, MAX_SIZE.height)) })
      }
    }
    const onUp = () => { dragRef.current.active = false; resizeRef.current.active = false }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [size])

  // TTS 播报 → Live2D 口型同步
  useEffect(() => {
    const unsub = window.api.tts.onSpeakingChanged((speaking) => setTalking(speaking))
    return unsub
  }, [])

  useEffect(() => {
    const onResize = () => {
      setPos((p) => ({ x: Math.min(p.x, Math.max(0, window.innerWidth - size.width)), y: Math.min(p.y, Math.max(0, window.innerHeight - size.height)) }))
    }
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [size])

  // 人物形象模型交互,通知 AIChat 处理交互信息
  const onTouch = (type: TouchType) => {
    const TouchMessage:Record<TouchType,string> = {
      ear: '用户摸了摸你的耳朵',
      head: '用户摸了摸你的头',
      face: '用户摸了摸你的脸',
      chest: '用户摸了摸你的胸部',
      belly: '用户摸了摸你的腹部',
      conceal: '用户摸了摸你的隐私部位',
      arm: '用户摸了摸你的手臂',
      hand: '用户摸了摸你的手',
      leg: '用户摸了摸你的腿',
      foot: '用户摸了摸你的脚',
      tail: '用户摸了摸你的尾巴',
    }
   
    bus.emit('model-interaction', TouchMessage[type])
  }

  return isOpen ? (
    <main
      className={styles.wapper}
      style={{ left: pos.x, top: pos.y, width: size.width, height: size.height }}
      onMouseDown={onDragStart}
    >
      <Live2D emotion={emotion ?? null} talking={talking} onTouch={onTouch} />
      <div className={styles.resizeHandle} onMouseDown={onResizeStart}>
        <svg width="12" height="12" viewBox="0 0 12 12">
          <path d="M0 12L12 0M12 12L12 0" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
        </svg>
      </div>
      <i className="iconfont icon-cocos-cancel" onClick={() => setIsOpen(false)} />
    </main>
  ) : (
    <img
      className={styles.imageMark}
      src={imageMark}
      alt="ai形象"
      onClick={() => setIsOpen(true)}
    />
  )
}

export default memo(Image)
