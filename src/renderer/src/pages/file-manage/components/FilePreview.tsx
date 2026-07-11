import { useState, useEffect } from 'react'
import styles from './FilePreview.module.css'
import { FileUnknownFilled } from '@ant-design/icons'

interface FilePreviewProps {
    filePath: string
    fileName?: string
    mimeType?: string
}

type PreviewType = 'image' | 'video' | 'audio' | 'pdf' | 'text' | 'unsupported'

function getPreviewType(filePath: string): PreviewType {
    const ext = filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
    if (['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg', '.bmp', '.ico'].includes(ext)) return 'image'
    if (['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext)) return 'video'
    if (['.mp3', '.wav', '.ogg', '.aac', '.flac', '.m4a'].includes(ext)) return 'audio'
    if (ext === '.pdf') return 'pdf'
    if (['.txt', '.md', '.json', '.xml', '.html', '.css', '.js', '.ts', '.py', '.java', '.go',
        '.rs', '.c', '.cpp', '.h', '.yaml', '.yml', '.toml', '.ini', '.sh', '.log',
        '.csv', '.env', '.gitignore', '.sql'].includes(ext)) return 'text'
    return 'unsupported'
}

/** 文本文件 — 带行号 */
function TextPreview({ filePath }: { filePath: string }) {
    const [content, setContent] = useState<string | null>(null)

    useEffect(() => {
        window.api.file.readFile(filePath).then(res => {
            if (res.ok && res.data) {
                setContent(new TextDecoder('utf-8').decode(res.data.content as ArrayBuffer))
            } else {
                setContent(`读取失败: ${res.error}`)
            }
        }).catch(err => {
            setContent(`读取失败: ${err.message}`)
        })
    }, [filePath])

    if (content === null) return null

    const lines = content.split('\n')
    return (
        <pre className={styles.textPreview}>
            {lines.map((line, i) => (
                <div key={i} className={styles.textLine}>
                    <span className={styles.lineNumber}>{i + 1}</span>
                    <span>{line || ' '}</span>
                </div>
            ))}
        </pre>
    )
}

export default function FilePreview({ filePath, fileName, mimeType }: FilePreviewProps) {
    const type = getPreviewType(filePath)

    
    const fileUrl = `file://${filePath}`
    console.log(type,fileUrl)
    let content: React.ReactNode = null

    switch (type) {
        case 'image':
            content = <img src={fileUrl} alt={fileName || ''} className={styles.mediaFull} />
            break
        case 'video':
            content = <video controls className={styles.mediaFull}><source src={fileUrl} /></video>
            break
        case 'audio':
            content = (
                <div className={styles.audioWrap}>
                    <p className={styles.audioName}>{fileName || '音频'}</p>
                    <audio controls className={styles.audioBar}><source src={fileUrl} /></audio>
                </div>
            )
            break
        case 'pdf':
            content = <iframe src={fileUrl} className={styles.pdfFull} title={fileName || 'PDF'} />
            break
        case 'text':
            content = <TextPreview filePath={filePath} />
            break
        default:
            return <div className={styles.previewIcon}>
                <div ><FileUnknownFilled style={{ fontSize: 50, color: '#6e6e6e' }} /></div>
                <div>{mimeType || '未知类型'}</div>
            </div>
    }

    return <div className={styles.previewWrap}>
        {content}
    </div>
}