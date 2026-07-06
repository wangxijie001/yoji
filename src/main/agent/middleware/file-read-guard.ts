import { createMiddleware, ToolMessage } from 'langchain'
import fs from 'fs'
import path from 'path'
import { app } from 'electron'
import { PDFParse } from 'pdf-parse'
import mammoth from 'mammoth'

const COMPANION_DIR = path.join(app.getPath('userData'), 'companion')

// 沙箱路径 → 绝对路径 (virtualMode: true, rootDir = COMPANION_DIR)
function resolveSandboxPath(filePath: string): string {
  if (filePath.startsWith('/')) filePath = filePath.slice(1)
  return path.join(COMPANION_DIR, filePath)
}

// MIME 白名单：只有这些类型的结果会作为 text 返回给模型
// 其他类型（PDF、图片、音视频等）返回为 file 块，DeepSeek/Qwen 不支持
// 参考 deepagents 源码 isTextMimeType()
const TEXT_EXTENSIONS = new Set([
  // 代码
  '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
  '.py', '.rb', '.java', '.c', '.cpp', '.h', '.hpp',
  '.go', '.rs', '.sh', '.bash', '.zsh',
  '.swift', '.kt', '.kts', '.scala', '.dart',
  '.lua', '.pl', '.pm', '.php',
  '.ex', '.exs', '.erl', '.hs', '.ml', '.mli',
  '.r', '.proto', '.sql', '.graphql',
  // 前端
  '.vue', '.svelte', '.astro',
  // 配置
  '.yaml', '.yml', '.toml', '.ini', '.cfg', '.conf', '.env',
  '.cmake', '.makefile', '.dockerfile',
  '.gitignore', '.dockerignore', '.editorconfig',
  '.tf',
  // 文档/数据
  '.txt', '.md', '.markdown', '.log',
  '.html', '.htm', '.css', '.csv', '.xml',
  '.json',
  '.svg',
])

// 可提取文字的文档格式
const PARSEABLE_EXTENSIONS = new Set(['.pdf', '.docx'])

// 纯二进制，直接拦截
const BLOCKED_EXTENSIONS = [
  '.ppt', '.pptx', '.doc', '.xls', '.xlsx',
  '.png', '.jpg', '.jpeg', '.gif', '.webp', '.heic', '.heif', '.ico', '.bmp',
  '.mp3', '.wav', '.aiff', '.aac', '.ogg', '.flac',
  '.mp4', '.webm', '.mpeg', '.mov', '.avi', '.flv', '.mpg', '.wmv',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
]

function getExt(filePath: string): string {
  return filePath.toLowerCase().slice(filePath.lastIndexOf('.'))
}

function isBlockedFile(filePath: string): boolean {
  const ext = getExt(filePath)
  if (TEXT_EXTENSIONS.has(ext)) return false
  if (PARSEABLE_EXTENSIONS.has(ext)) return false
  if (BLOCKED_EXTENSIONS.some(e => filePath.toLowerCase().endsWith(e))) return true
  return false
}

function isParseableFile(filePath: string): boolean {
  return PARSEABLE_EXTENSIONS.has(getExt(filePath))
}

async function parsePdf(filePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath)
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    await parser.destroy()
    const text = result.text?.trim()
    if (!text) return null // 扫描件
    return text
  } catch (err) {
    console.error('[fileReadGuard] PDF parse error:', err)
    return null
  }
}

async function parseDocx(filePath: string): Promise<string | null> {
  try {
    const buffer = fs.readFileSync(filePath)
    const result = await mammoth.extractRawText({ buffer })
    const text = result.value?.trim()
    if (!text) return null
    return text
  } catch (err) {
    console.error('[fileReadGuard] DOCX parse error:', err)
    return null
  }
}

async function parseDocument(filePath: string): Promise<string | null> {
  const ext = getExt(filePath)
  switch (ext) {
    case '.pdf':
      return parsePdf(filePath)
    case '.docx':
      return parseDocx(filePath)
    default:
      return null
  }
}

/**
 * 文件读取拦截 Middleware
 *
 * - PDF 等可解析文档：提取文字后返回 text，不阻塞
 * - 图片/音视频/压缩包等纯二进制：拦截，返回错误提示
 * - 文本文件：放行
 */
export const fileReadGuard = createMiddleware({
  name: 'fileReadGuard',
  wrapToolCall: async (request, handler) => {
    if (request.toolCall.name === 'read_file') {
      const filePath = request.toolCall.args?.file_path
      if (typeof filePath === 'string') {
        const absolutePath = resolveSandboxPath(filePath)

        if (isParseableFile(absolutePath)) {
          const text = await parseDocument(absolutePath)
          if (text) {
            return new ToolMessage({
              name: 'read_file',
              content: text,
              tool_call_id: request.toolCall.id ?? '',
            })
          }
          return new ToolMessage({
            name: 'read_file',
            content: `无法读取 ${filePath}：此文件可能为扫描件、图片或无文字层，不支持提取文字。`,
            tool_call_id: request.toolCall.id ?? '',
          })
        }

        if (isBlockedFile(absolutePath)) {
          return new ToolMessage({
            name: 'read_file',
            content: `无法读取 ${filePath}：该文件为二进制格式，不支持直接读取。`,
            tool_call_id: request.toolCall.id ?? '',
          })
        }
      }
    }
    return handler(request)
  },
})