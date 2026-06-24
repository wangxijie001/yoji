import { useState, useRef, useEffect, useCallback, memo } from 'react'
import styles from './Image.module.css'

// 视频放 src/renderer/src/assets/video/，用 Vite 标准 import 拿 URL
import imageMark from '@renderer/assets/image/imageMark.jpeg'
import calmVideo from '@renderer/assets/video/calm.mp4'
import shyVideo from '@renderer/assets/video/shy.mp4'
import hurtVideo from '@renderer/assets/video/hurt.mp4'
import expectVideo from '@renderer/assets/video/expect.mp4'
import sadVideo from '@renderer/assets/video/sad.mp4'
import happyVideo from '@renderer/assets/video/happy.mp4'
import tiredVideo from '@renderer/assets/video/tired.mp4'



// 情绪 → 视频文件映射（加好视频后在这里 import 并填入）
const VIDEO_MAP: Record<string, string> = {
    '开心': happyVideo,
    '平静': calmVideo,
    '害羞': shyVideo,
    '疲惫': tiredVideo,
    '期待': expectVideo,
    '好奇': expectVideo,
    '悲伤': sadVideo,
    '委屈': hurtVideo,
    '失落': hurtVideo,
    '孤独': hurtVideo,
}


const MIN_SIZE = { width: 120, height: 120 }
const MAX_SIZE = { width: 600, height: 600 }
const INITIAL = { width: 200, height: 260, margin: 16 }

const Image = ({ emotion }: { emotion?: string }) => {
    const [pos, setPos] = useState(() => ({
        x: window.innerWidth - INITIAL.width - INITIAL.margin,
        y: INITIAL.margin,
    }))
    const [size, setSize] = useState({ width: INITIAL.width, height: INITIAL.height })
    const [isOpen, setIsOpen] = useState(false)
    const dragRef = useRef({ active: false, startX: 0, startY: 0, originX: 0, originY: 0 })
    const resizeRef = useRef({ active: false, startX: 0, startY: 0, originW: 0, originH: 0 })
    const containerRef = useRef<HTMLDivElement>(null)

    const videoSrc = VIDEO_MAP[emotion || ''] || ''

    // 拖拽
    const onDragStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            dragRef.current = { active: true, startX: e.clientX, startY: e.clientY, originX: pos.x, originY: pos.y }
        },
        [pos],
    )

    // 调整大小
    const onResizeStart = useCallback(
        (e: React.MouseEvent) => {
            e.preventDefault()
            e.stopPropagation()
            resizeRef.current = { active: true, startX: e.clientX, startY: e.clientY, originW: size.width, originH: size.height }
        },
        [size],
    )

    useEffect(() => {
        const onMove = (e: MouseEvent) => {
            if (dragRef.current.active) {
                const newX = dragRef.current.originX + (e.clientX - dragRef.current.startX)
                const newY = dragRef.current.originY + (e.clientY - dragRef.current.startY)
                setPos({
                    x: Math.max(0, Math.min(newX, window.innerWidth - size.width)),
                    y: Math.max(0, Math.min(newY, window.innerHeight - size.height)),
                })
            }
            if (resizeRef.current.active) {
                const dw = resizeRef.current.originW + (e.clientX - resizeRef.current.startX)
                const dh = resizeRef.current.originH + (e.clientY - resizeRef.current.startY)
                const newW = Math.max(MIN_SIZE.width, Math.min(dw, MAX_SIZE.width))
                const newH = Math.max(MIN_SIZE.height, Math.min(dh, MAX_SIZE.height))
                setSize({ width: newW, height: newH })
            }
        }
        const onUp = () => {
            dragRef.current.active = false
            resizeRef.current.active = false
        }
        window.addEventListener('mousemove', onMove)
        window.addEventListener('mouseup', onUp)
        return () => {
            window.removeEventListener('mousemove', onMove)
            window.removeEventListener('mouseup', onUp)
        }
    }, [size])

    // 窗口大小变化时，确保不超出视口
    useEffect(() => {
        const onResize = () => {
            setPos((p) => ({
                x: Math.min(p.x, Math.max(0, window.innerWidth - size.width)),
                y: Math.min(p.y, Math.max(0, window.innerHeight - size.height)),
            }))
        }
        window.addEventListener('resize', onResize)
        return () => window.removeEventListener('resize', onResize)
    }, [size])

    return (
       isOpen ? <main
            ref={containerRef}
            className={styles.wapper}
            style={{
                left: pos.x,
                top: pos.y,
                width: size.width,
                height: size.height,
            }}
            onMouseDown={onDragStart}
        >
            <video
                key={videoSrc}
                className={styles.video}
                src={videoSrc}
                autoPlay
                loop
                muted
                playsInline
            />
            {/* 右下角缩放把手 */}
            <div className={styles.resizeHandle} onMouseDown={onResizeStart}>
                <svg width="12" height="12" viewBox="0 0 12 12">
                    <path d="M0 12L12 0M12 12L12 0" stroke="rgba(255,255,255,0.5)" strokeWidth="2" />
                </svg>
            </div>
            <i className='iconfont icon-cocos-cancel' onClick={() => setIsOpen(false)} />
        </main> : <img
           className={styles.imageMark}
            src={imageMark}
            alt={'ai形象'}
            onClick={() => setIsOpen(true)}
        />
       )
}

export default memo(Image)
