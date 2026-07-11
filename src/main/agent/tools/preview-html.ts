import { tool } from 'langchain'
import { z } from 'zod'
import { BrowserWindow } from 'electron'
import { existsSync } from 'fs'

/**
 * 内置 HTML 预览工具
 *
 * Agent 编写 HTML（或先 write_file 写磁盘）→ 在 Electron 新窗口中渲染。
 * 支持两种传参方式：
 * - html: 完整 HTML 源码字符串
 * - path: 磁盘上的 HTML 文件绝对路径
 */
export const previewHtml = tool(
  async ({ html, path, title }: { html?: string; path?: string; title?: string }) => {
    const win = new BrowserWindow({
      width: 700,
      height: 520,
      title: title || '预览',
      webPreferences: {
        sandbox: false, // file:// 协议需要关闭 sandbox
        webSecurity: false, // 允许加载本地资源
      },
    })

    win.setMenuBarVisibility(false)

    // 优先用文件路径
    if (path && existsSync(path)) {
      win.loadURL(`file://${path}`)
      return `已在窗口「${title || '预览'}」中打开：${path}`
    }

    // 否则作为 HTML 字符串渲染
    if (html) {
      win.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`)
      return `已在窗口「${title || '预览'}」中打开`
    }

    return '未提供 html 或 path'
  },
  {
    name: 'preview_html',
    description:
      '在应用内窗口中预览 HTML 内容。用于播放视频、展示图片画廊、渲染图表、数据可视化等。\n\n' +
      '用法：先用 write_file 将 HTML 写入磁盘，再传 path 打开。\n' +
      '⚠️ path 必须是磁盘上的真实绝对路径（如 /Users/xxx/companion/xxx.html），禁止使用沙箱虚拟路径（如 /xxx.html）。',
    schema: z.object({
      html: z.string().optional().describe('完整 HTML 源码字符串（短内容可用）'),
      path: z.string().optional().describe('HTML 文件的磁盘绝对路径。⚠️ 必须是真实文件系统路径，如 /Users/xxx/companion/xxx.html，禁止用沙箱路径'),
      title: z.string().optional().describe('窗口标题'),
    }),
  }
)
