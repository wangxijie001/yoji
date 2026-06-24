import { ipcMain, app, dialog, BrowserWindow } from 'electron'
import { readFileSync, writeFileSync, copyFileSync, existsSync, readdirSync, statSync, rmSync, mkdirSync } from 'fs'
import { join, relative } from 'path'
import { gzipSync, gunzipSync } from 'zlib'

const COMPANION_DIR = join(app.getPath('userData'), 'companion')
const PWD_TOKEN = 'agent_love_001'

export type ExportType = 'db' | 'md' | 'all'

const EXPORT_TARGETS: Record<ExportType, { src: string; defaultName: string; ext: string } | null> = {
  db: { src: join(COMPANION_DIR, 'companion.db'), defaultName: 'companion.db', ext: 'db' },
  md: { src: join(COMPANION_DIR, 'AGENTS.md'), defaultName: 'AGENTS.md', ext: 'md' },
  all: null,
}

/** 递归收集目录下所有文件，返回 { 相对路径: Buffer } */
function collectFiles(dir: string): Record<string, Buffer> {
  const files: Record<string, Buffer> = {}
  const walk = (current: string) => {
    for (const name of readdirSync(current)) {
      if (name.startsWith('.') || name.endsWith('-wal') || name.endsWith('-shm')) continue
      const full = join(current, name)
      if (statSync(full).isDirectory()) {
        walk(full)
      } else {
        files[relative(dir, full)] = readFileSync(full)
      }
    }
  }
  walk(dir)
  return files
}

/** 清空 companion 目录下的所有文件和子目录 */
function clearCompanionDir(): void {
  for (const name of readdirSync(COMPANION_DIR)) {
    rmSync(join(COMPANION_DIR, name), { recursive: true, force: true })
  }
}

export function register(): void {
  ipcMain.handle('file:readAgentsMd', async () => {
    try {
      const path = join(COMPANION_DIR, 'AGENTS.md')
      const content = readFileSync(path, 'utf-8')
      return { ok: true, data: content }
    } catch (err) {
      const message = err instanceof Error ? err.message : '读取 AGENTS.md 失败'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('file:export', async (event, type: ExportType) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { ok: false, error: '窗口不存在' }

      if (type === 'all') {
        const result = await dialog.showSaveDialog(win, {
          title: '导出伴侣数据',
          defaultPath: `companion-backup-${Date.now()}.ecompanion`,
          filters: [{ name: '伴侣数据', extensions: ['ecompanion'] }],
          buttonLabel: '导出',
        })
        if (result.canceled || !result.filePath) {
          return { ok: false, error: '已取消' }
        }

        const rawFiles = collectFiles(COMPANION_DIR)
        const textFiles: Record<string, string> = {}
        const binFiles: Record<string, string> = {}

        for (const [name, buf] of Object.entries(rawFiles)) {
          if (name.endsWith('.db')) {
            binFiles[name] = buf.toString('base64')
          } else {
            textFiles[name] = buf.toString('utf-8')
          }
        }

        const bundle = JSON.stringify({
          manifest: {
            app: 'yoji',
            token: PWD_TOKEN,
            exportedAt: Date.now(),
          },
          textFiles,
          binFiles,
        })

        writeFileSync(result.filePath, gzipSync(bundle))
        return { ok: true, data: result.filePath }
      }

      // 导出单个文件
      const target = EXPORT_TARGETS[type]
      if (!target || !existsSync(target.src)) {
        return { ok: false, error: `文件不存在: ${target?.src ?? type}` }
      }
      const result = await dialog.showSaveDialog(win, {
        title: '导出文件',
        defaultPath: target.defaultName,
        buttonLabel: '导出',
      })
      if (result.canceled || !result.filePath) {
        return { ok: false, error: '已取消' }
      }
      copyFileSync(target.src, result.filePath)
      return { ok: true, data: result.filePath }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导出失败'
      return { ok: false, error: message }
    }
  })

  ipcMain.handle('file:import', async (event, type: ExportType) => {
    try {
      const win = BrowserWindow.fromWebContents(event.sender)
      if (!win) return { ok: false, error: '窗口不存在' }

      if (type === 'all') {
        const result = await dialog.showOpenDialog(win, {
          title: '导入伴侣数据',
          filters: [{ name: '伴侣数据', extensions: ['ecompanion'] }],
          properties: ['openFile'],
          buttonLabel: '导入',
        })
        if (result.canceled || result.filePaths.length === 0) {
          return { ok: false, error: '已取消' }
        }

        const raw = gunzipSync(readFileSync(result.filePaths[0]))
        const bundle = JSON.parse(raw.toString('utf-8'))

        if (!bundle.manifest || bundle.manifest.app !== 'yoji') {
          return { ok: false, error: '该文件不是有效的伴侣数据备份' }
        }
        if (bundle.manifest.token !== PWD_TOKEN) {
          return { ok: false, error: '鉴权失败：识别码不匹配' }
        }

        // 先清空再写入，做到全量还原
        clearCompanionDir()
        mkdirSync(COMPANION_DIR, { recursive: true })
        let count = 0

        for (const [name, content] of Object.entries<string>(bundle.textFiles || {})) {
          const dest = join(COMPANION_DIR, name)
          mkdirSync(join(dest, '..'), { recursive: true })
          writeFileSync(dest, content, 'utf-8')
          count++
        }
        for (const [name, b64] of Object.entries<string>(bundle.binFiles || {})) {
          const dest = join(COMPANION_DIR, name)
          mkdirSync(join(dest, '..'), { recursive: true })
          writeFileSync(dest, Buffer.from(b64, 'base64'))
          count++
        }

        return { ok: true, data: `已导入 ${count} 个文件，重启后生效` }
      }

      // 导入单个文件——直接覆盖
      const target = EXPORT_TARGETS[type]
      if (!target) {
        return { ok: false, error: `不支持的导入类型: ${type}` }
      }
      const result = await dialog.showOpenDialog(win, {
        title: `导入 ${target.defaultName}`,
        filters: [{ name: target.defaultName, extensions: [target.ext] }],
        properties: ['openFile'],
        buttonLabel: '导入',
      })
      if (result.canceled || result.filePaths.length === 0) {
        return { ok: false, error: '已取消' }
      }
      copyFileSync(result.filePaths[0], target.src)
      return { ok: true, data: `${target.defaultName} 已覆盖` }
    } catch (err) {
      const message = err instanceof Error ? err.message : '导入失败'
      return { ok: false, error: message }
    }
  })
}
