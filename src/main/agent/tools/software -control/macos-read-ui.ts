import { tool } from 'langchain'
import { z } from 'zod'
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'

function osa(script: string): string {
  const tmp = `/tmp/yoji_osa_${Date.now()}.applescript`
  writeFileSync(tmp, script, 'utf-8')
  try {
    return execSync(`osascript "${tmp}"`, {
      encoding: 'utf-8',
      timeout: 30000,
      maxBuffer: 10 * 1024 * 1024,
    }).trim()
  } finally {
    try { unlinkSync(tmp) } catch (_) {}
  }
}

const HARD_LIMIT = 100 // AppleScript 层：超过 100 个直接拒，让 AI 缩小范围
const SOFT_LIMIT = 50  // JS 层：超过 50 个加个提醒，但完整返回

export const macosReadUI = tool(
  async ({ appName, parentPath, filterRole }: {
    appName?: string
    parentPath?: number[]
    filterRole?: string
  }) => {
    const target = appName
      ? `first application process whose name is "${appName}"`
      : 'first application process whose frontmost is true'

    let targetEl = 'front window of frontProc'
    if (parentPath && parentPath.length > 0) {
      const chain = [...parentPath].reverse()
      targetEl = chain.map(i => `UI element ${i} of`).join(' ') + ' ' + targetEl
    }

    const raw = osa(`
      tell application "System Events"
        set frontProc to ${target}
        try
          set targetEl to ${targetEl}
          set children to UI elements of targetEl
          set n to count of children
          if n > ${HARD_LIMIT} then
            return "TOO_MANY:" & n
          end if
          set _json to ""
          repeat with i from 1 to n
            set el to item i of children
            set _role to ""
            set _title to ""
            set _desc to ""
            set _x to 0
            set _y to 0
            set _w to 0
            set _h to 0
            set _kids to false
            try
              set _role to role of el
            end try
            try
              set _title to title of el
            end try
            try
              set _desc to description of el
            end try
            try
              set pos to position of el
              set _x to item 1 of pos
              set _y to item 2 of pos
            end try
            try
              set sz to size of el
              set _w to item 1 of sz
              set _h to item 2 of sz
            end try
            try
              set _kids to (count of UI elements of el) > 0
            end try
            set _line to i & "@@@@" & _role & "@@@@" & _title & "@@@@" & _desc & "@@@@" & _x & "@@@@" & _y & "@@@@" & _w & "@@@@" & _h & "@@@@" & _kids
            if i > 1 then set _json to _json & return
            set _json to _json & _line
          end repeat
          return _json
        on error err
          return "ERROR:" & err
        end try
      end tell`)

    if (raw.startsWith('TOO_MANY:')) {
      const n = parseInt(raw.split(':')[1])
      return JSON.stringify({
        hint: `该层级有 ${n} 个元素，超出上限。建议用 filterRole 缩小范围（如 filterRole="AXButton"），或从上一级选择一个有 children 的元素，用 parentPath 下钻。`,
        total: n,
        elements: [],
      })
    }

    if (raw.startsWith('ERROR:')) {
      return JSON.stringify({ error: raw })
    }

    let elements = raw.split('\r').filter(Boolean).map(line => {
      const [idx, role, title, desc, x, y, w, h, kids] = line.split('@@@@')
      const labels = [title, desc].filter(s => s && s !== 'missing value')
      return {
        index: parseInt(idx),
        role,
        label: labels.length > 0 ? labels.join(' · ') : role,
        pos: { x: parseInt(x), y: parseInt(y), w: parseInt(w), h: parseInt(h) },
        click: { x: Math.round(parseInt(x) + parseInt(w) / 2), y: Math.round(parseInt(y) + parseInt(h) / 2) },
        children: kids === 'true',
      }
    })

    // JS 侧过滤
    if (filterRole) {
      elements = elements.filter(el =>
        el.role.toLowerCase().includes(filterRole.toLowerCase())
      )
    }

    const total = raw.split('\r').filter(Boolean).length

    return JSON.stringify({
      app: appName || '(frontmost)',
      parentPath: parentPath || [],
      total,
      ...(total > SOFT_LIMIT ? { hint: `共 ${total} 个元素，建议用 filterRole 缩小范围（如 filterRole="AXButton"），或用 parentPath 下钻到有 children 的控件` } : {}),
      elements,
    })
  },
  {
    name: 'macos_read_ui',
    description:
      '读取 macOS 应用的 UI 元素树。每次返回一层，通过 parentPath 逐层下钻。\n\n' +
      '用法：\n' +
      '- appName="WeChat" → 查看微信的顶层 UI\n' +
      '- parentPath=[13] → 展开第 13 个元素（看它下面有什么）\n' +
      '- parentPath=[13,5] → 继续展开第 5 个子元素\n' +
      '- filterRole="AXButton" → 只返回按钮类型\n\n' +
      '每个元素含：index、role、label（语义标签）、pos（位置）、click（点击坐标）、children（true=可继续下钻）。',
    schema: z.object({
      appName: z.string().optional().describe('应用名，如 WeChat、Safari。不传取前台应用'),
      parentPath: z.array(z.number()).optional().describe('下钻路径，[13] 展开第13个元素，[13,2] 继续下钻'),
      filterRole: z.string().optional().describe('只返回特定角色，如 AXButton、AXTextField、AXMenu。缩小范围用'),
    }),
  }
)
