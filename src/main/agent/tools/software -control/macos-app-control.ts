import { tool } from 'langchain'
import { z } from 'zod'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 15000, maxBuffer: 10 * 1024 * 1024 }).trim()
}

// ---- 列出已安装 App ----

export const macosListApps = tool(
  async () => {
    const sysApps = sh('find /Applications -maxdepth 3 -name "*.app" 2>/dev/null')
    const userApps = sh('find ~/Applications -maxdepth 3 -name "*.app" 2>/dev/null')
    const extraApps = sh('find /System/Applications -maxdepth 2 -name "*.app" 2>/dev/null')

    const apps = [...sysApps.split('\n'), ...userApps.split('\n'), ...extraApps.split('\n')]
      .filter(Boolean)
      .filter(p => !p.includes('.app/'))
      .map(p => ({
        name: p.split('/').pop()?.replace('.app', '') || '',
        path: p,
      }))

    const unique = [...new Map(apps.map(a => [a.name, a])).values()].sort((a, b) =>
      a.name.localeCompare(b.name)
    )

    return JSON.stringify({ count: unique.length, apps: unique })
  },
  {
    name: 'macos_list_apps',
    description: '列出 macOS 上所有已安装的应用程序（含系统和用户安装的）',
    schema: z.object({}),
  }
)

// ---- 打开/激活 App ----

export const macosLaunchApp = tool(
  async ({ name }: { name: string }) => {
    const script = `tell application "${name}"
  reopen
  repeat with w in windows
    try
      if miniaturized of w then set miniaturized of w to false
    end try
  end repeat
  activate
end tell`
    const tmp = `/tmp/yoji_launch_${Date.now()}.applescript`
    writeFileSync(tmp, script, 'utf-8')
    try {
      sh(`osascript "${tmp}"`)
      return `已打开 ${name}`
    } catch (e: any) {
      return `未找到应用: ${name}，可用 macos_list_apps 查看已安装的应用列表`
    } finally {
      try { unlinkSync(tmp) } catch (_) {}
    }
  },
  {
    name: 'macos_launch_app',
    description:
      '打开或激活 macOS 应用程序。App 未运行时启动它，最小化时恢复窗口，已运行时切到前台。\n' +
      '参数 name 为应用名称（如 "Safari"、"Google Chrome"、"Code"）',
    schema: z.object({
      name: z.string().describe('应用名称，如 Safari、Google Chrome、Code'),
    }),
  }
)

// ---- 点击 ----

export const macosClick = tool(
  async ({ x, y }: { x: number; y: number }) => {
    try {
      sh(`osascript -e 'tell application "System Events" to click at {${x}, ${y}}'`)
      return `已点击坐标 (${x}, ${y})`
    } catch (e: any) {
      return `点击失败: ${e.message}`
    }
  },
  {
    name: 'macos_click',
    description:
      '在 macOS 屏幕上点击指定坐标。配合 macos_read_ui 使用：先读取 UI 树获取目标元素的 click 坐标，再调用本工具点击。',
    schema: z.object({
      x: z.number().describe('屏幕 X 坐标'),
      y: z.number().describe('屏幕 Y 坐标'),
    }),
  }
)

// ---- 键盘输入 ----

export const macosTypeText = tool(
  async ({ text }: { text: string }) => {
    const tmp = `/tmp/yoji_clipboard_${Date.now()}.txt`
    writeFileSync(tmp, text, 'utf-8')
    try {
      // 写入剪贴板 → Cmd+V 粘贴，避免 keystroke 的转义问题
      sh(`cat "${tmp}" | pbcopy && osascript -e 'tell application "System Events" to keystroke "v" using command down'`)
      return `已输入文本`
    } catch (e: any) {
      return `输入失败: ${e.message}`
    } finally {
      try { unlinkSync(tmp) } catch (_) {}
    }
  },
  {
    name: 'macos_type_text',
    description:
      '在当前焦点位置输入文本（模拟键盘输入）。使用前请确保目标输入框已获得焦点（可先用 macos_click 点击输入框）。',
    schema: z.object({
      text: z.string().describe('要输入的文本内容'),
    }),
  }
)

// ---- 按键 ----

// macOS key codes for special keys
const KEY_CODES: Record<string, number> = {
  'return': 36, 'enter': 36,
  'tab': 48,
  'space': 49,
  'delete': 51, 'backspace': 51,
  'escape': 53, 'esc': 53,
  'left': 123, 'right': 124,
  'down': 125, 'up': 126,
  'home': 115, 'end': 119,
  'pageup': 116, 'pagedown': 121,
  'f1': 122, 'f2': 120, 'f3': 99, 'f4': 118, 'f5': 96,
  'f6': 97, 'f7': 98, 'f8': 100, 'f9': 101, 'f10': 109,
  'f11': 103, 'f12': 111,
}

export const macosPressKey = tool(
  async ({ key, modifiers }: { key: string; modifiers?: string[] }) => {
    try {
      const mods = modifiers && modifiers.length > 0
      const modStr = mods ? modifiers!.join(' down, ') + ' down' : ''

      // build AppleScript: special keys use key code, regular chars use keystroke
      let applescript: string
      const keyCode = KEY_CODES[key.toLowerCase()]
      if (keyCode !== undefined) {
        // special key → always use key code (works with or without modifiers)
        applescript = mods
          ? `tell application "System Events" to key code ${keyCode} using {${modStr}}`
          : `tell application "System Events" to key code ${keyCode}`
      } else if (mods) {
        // regular char + modifiers → keystroke with using
        applescript = `tell application "System Events" to keystroke "${key}" using {${modStr}}`
      } else {
        // regular char, no modifiers → simple keystroke
        applescript = `tell application "System Events" to keystroke "${key}"`
      }

      sh(`osascript -e '${applescript}'`)
      const modDesc = mods ? ` (${modifiers!.join('+')}+${key})` : ''
      return `已按键: ${key}${modDesc}`
    } catch (e: any) {
      return `按键失败: ${e.message}`
    }
  },
  {
    name: 'macos_press_key',
    description:
      '按下键盘按键或组合键。key 为按键名（如 return、escape、tab、space、delete、left、right、f1），modifiers 为修饰键列表（command、shift、option、control）。\n' +
      '示例: key="c" modifiers=["command"] → Cmd+C 复制',
    schema: z.object({
      key: z.string().describe('按键名，如 return、escape、tab、a、1'),
      modifiers: z.array(z.enum(['command', 'shift', 'option', 'control'])).optional().describe('修饰键列表'),
    }),
  }
)

// ---- 退出 App ----

export const macosQuitApp = tool(
  async ({ name }: { name: string }) => {
    try {
      // 优雅退出（允许保存未保存内容）
      sh(`osascript -e 'tell application "${name}" to quit'`)
      return `已退出 ${name}`
    } catch {
      // 可能没运行或名字不对，直接强制杀掉
      try {
        sh(`pkill -x "${name}"`)
        return `已强制退出 ${name}`
      } catch {
        return `${name} 可能未运行`
      }
    }
  },
  {
    name: 'macos_quit_app',
    description: '退出 macOS 应用程序。先尝试优雅退出（允许保存），失败后强制结束进程。',
    schema: z.object({
      name: z.string().describe('应用名称，如 Safari、Calculator'),
    }),
  }
)

//