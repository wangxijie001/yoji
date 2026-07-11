//额外打开浏览器视口
import { ipcMain, BrowserWindow } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import icon from '../../../resources/icon.png?asset'

export function register(): void {
  // 渲染进程传入一个地址，额外开一个窗口打开
  //   - http(s) 开头        → 外部网页直接加载
  //   - 其他(如 /task-monitor) → 应用内 HashRouter 路由加载
  ipcMain.handle('browserWindow:open', (_, url: string) => {
    const win = new BrowserWindow({
      width: 800,
      height: 600,
      show: false,
      autoHideMenuBar: true,
      titleBarStyle: 'hidden',
      ...(process.platform !== 'darwin' ? { icon } : {}),
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        webSecurity: false
      }
    })

    win.on('ready-to-show', () => win.show())

    if (/^https?:\/\//.test(url)) {
      win.loadURL(url)
    } else {
      const path = url.startsWith('/') ? url : `/${url}`
      if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
        win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}#${path}`)
      } else {
        win.loadFile(join(__dirname, '../renderer/index.html'), { hash: path })
      }
    }

    return { ok: true }
  })
}
