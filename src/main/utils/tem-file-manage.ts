import { join } from 'path'
import { writeFileSync, readFileSync, mkdirSync, existsSync, rmSync } from 'fs'
import { app } from 'electron'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')
const TEMP_DIR = join(COMPANION_DIR, 'tem')

/**
 * 写入临时文件（统一放在 companion/tem/ 下）
 * @param relativePath  tem/ 下的相对路径，自动创建父目录
 * @param value         写入内容（字符串）
 * @returns             写入后的绝对路径
 *
 * @example
 *   writeTemp('tasks/task_abc.json', JSON.stringify({ status: 'running' }))
 *     → companion/tem/tasks/task_abc.json
 *
 * @example
 *   writeTemp('cache/search_result.html', '<div>...</div>')
 *     → companion/tem/cache/search_result.html
 */
export function writeTemp(relativePath: string, value: string): string {
  const fullPath = join(TEMP_DIR, relativePath)
  if (!fullPath.startsWith(TEMP_DIR)) {
    throw new Error('不允许写入 temp 目录外的路径')
  }
  mkdirSync(join(fullPath, '..'), { recursive: true })
  writeFileSync(fullPath, value, 'utf-8')
  return fullPath
}

/**
 * 读取临时文件（统一从 companion/tem/ 下读取）
 * @param relativePath  tem/ 下的相对路径
 * @returns             文件内容，不存在时返回 null
 *
 * @example
 *   readTemp('tasks/task_abc.json')   → '{"status":"running"}'
 *   readTemp('nonexistent.txt')       → null
 */
export function readTemp(relativePath: string): string | null {
  const fullPath = join(TEMP_DIR, relativePath)
  if (!existsSync(fullPath)) return null
  return readFileSync(fullPath, 'utf-8')
}

/** 清除 companion/tem/ 下所有文件，应用启动时调用 */
export function clearTemp(): void {
  if (!existsSync(TEMP_DIR)) return
  rmSync(TEMP_DIR, { recursive: true, force: true })
  console.log('[temp] tem 目录已清理')
}
