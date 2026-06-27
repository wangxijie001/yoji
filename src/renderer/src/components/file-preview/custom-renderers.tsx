/**
 * 文件预览自定义渲染器
 *
 * 独立组件，不依赖任何第三方文件预览库。
 * 通过 Blob.text() 读取文件内容，避免 Electron 下 fetch(blobUrl) 的 ERR_FILE_NOT_FOUND 问题。
 */

import { useEffect, useState } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import rehypePrism from 'rehype-prism-plus'
import 'prism-themes/themes/prism-material-oceanic.css'

// ---- 工具函数 ----

export function extToLang(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'tsx', js: 'javascript', jsx: 'jsx',
    mjs: 'javascript', cjs: 'javascript', json: 'json',
    css: 'css', scss: 'scss', less: 'less',
    html: 'html', htm: 'html', xml: 'xml', svg: 'svg',
    yml: 'yaml', yaml: 'yaml',
    py: 'python', java: 'java', c: 'c', cpp: 'cpp', h: 'c',
    go: 'go', rs: 'rust', rb: 'ruby', php: 'php',
    swift: 'swift', kt: 'kotlin',
    sh: 'bash', bash: 'bash', zsh: 'bash',
    sql: 'sql', graphql: 'graphql',
    txt: 'plaintext',
  }
  return map[ext] || 'plaintext'
}

// ---- 判断函数 ----

/** 是否应使用 Markdown 渲染器 */
export function isMarkdownFile(_fileName: string, mimeType: string): boolean {
  return mimeType === 'text/markdown'
}

/** 是否应使用代码渲染器 */
export function isCodeFile(fileName: string, mimeType: string): boolean {
  if (mimeType === 'text/markdown') return false
  const lang = extToLang(fileName)
  return lang !== 'plaintext' || mimeType === 'text/plain' || mimeType.startsWith('text/')
}

// ---- Markdown 预览 ----

interface PreviewProps {
  blob: Blob
  fileName: string
  onLoad?: () => void
  onError?: () => void
}

export function MarkdownPreview({ blob, onLoad, onError }: PreviewProps) {
  const [text, setText] = useState('')

  useEffect(() => {
    if (!blob) {
      onError?.()
      return
    }
    blob.text().then(setText).then(onLoad).catch(onError)
  }, [blob])

  return (
    <div style={{ padding: '16px 20px', overflow: 'auto', height: '100%' }}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}
      >
        {text}
      </ReactMarkdown>
    </div>
  )
}

// ---- 代码预览 ----

export function CodePreview({ blob, fileName, onLoad, onError }: PreviewProps) {
  const [text, setText] = useState('')
  const lang = extToLang(fileName)

  useEffect(() => {
    if (!blob) {
      onError?.()
      return
    }
    blob.text().then(setText).then(onLoad).catch(onError)
  }, [blob])

  const markdown = '```' + lang + '\n' + text + '\n```'

  return (
    <div style={{ padding: '16px 20px', overflow: 'auto', height: '100%' }}>
      <ReactMarkdown rehypePlugins={[[rehypePrism, { showLineNumbers: true }]]}>
        {markdown}
      </ReactMarkdown>
    </div>
  )
}
