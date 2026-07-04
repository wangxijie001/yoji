import { app } from 'electron'
import { join } from 'path'
import { appendFileSync, mkdirSync } from 'fs'

const LOG_DIR = join(app.getPath('userData'), 'companion', 'logs')

function ensureDir() {
  try { mkdirSync(LOG_DIR, { recursive: true }) } catch { /* */ }
}

// 接管全局 console，所有终端日志同步写入文件
export function initLogger(): void {
  ensureDir()
  const logFile = join(LOG_DIR, 'yoji.log')

  const _log = console.log.bind(console)
  const _error = console.error.bind(console)
  const _warn = console.warn.bind(console)

  const fmt = (args: unknown[]) =>
    args.map(a => a instanceof Error ? (a.stack || a.message) : typeof a === 'object' ? JSON.stringify(a) : String(a)).join(' ')

  console.log = (...args: unknown[]) => {
    _log(...args)
    try { appendFileSync(logFile, `[${new Date().toISOString()}] ${fmt(args)}\n`) } catch { /* */ }
  }
  console.error = (...args: unknown[]) => {
    _error(...args)
    try { appendFileSync(logFile, `[${new Date().toISOString()}] [ERROR] ${fmt(args)}\n`) } catch { /* */ }
  }
  console.warn = (...args: unknown[]) => {
    _warn(...args)
    try { appendFileSync(logFile, `[${new Date().toISOString()}] [WARN] ${fmt(args)}\n`) } catch { /* */ }
  }

  _log(`[Logger] 日志文件: ${logFile}`)
}
