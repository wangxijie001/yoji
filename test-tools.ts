// @ts-nocheck
import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'

function sh(cmd: string): string {
  return execSync(cmd, { encoding: 'utf-8', timeout: 30000, maxBuffer: 10 * 1024 * 1024 }).trim()
}
function osa(script: string): string {
  const tmp = '/tmp/test_osa_' + Date.now() + '.applescript'
  writeFileSync(tmp, script, 'utf-8')
  try { return sh(`osascript "${tmp}"`) }
  finally { try { unlinkSync(tmp) } catch (_) {} }
}

// ============================================================
// 层级 UI 树
// ============================================================

// ============================================================
// 列出正在运行的 App
// ============================================================
function listOpenApps(): { name: string; pid: number }[] {
  const apps = sh(
    'osascript -e \'tell application "System Events" to return name of every application process whose background only is false\''
  )
  return apps.split(', ').sort().map(name => ({ name, pid: 0 }))
}

function testListOpenApps() {
  console.log('=== 正在运行的 App ===')
  listOpenApps().forEach((a, i) => console.log(`  ${i + 1}. ${a.name}`))
}

// ============================================================
// 层级 UI 树（支持 bundleId / role 过滤）
// ============================================================
function getUILevel(opts?: {
  appName?: string
  bundleId?: string
  parentPath?: number[]
  filterRole?: string
}) {
  const target = opts?.bundleId
    ? `first application process whose bundle identifier is "${opts.bundleId}"`
    : opts?.appName
      ? `first application process whose name is "${opts.appName}"`
      : 'first application process whose frontmost is true'

  let targetEl = 'front window of frontProc'
  if (opts?.parentPath && opts.parentPath.length > 0) {
    const chain = [...opts.parentPath].reverse()
    targetEl = chain.map(i => `UI element ${i} of`) .join(' ') + ' ' + targetEl
  }

  const raw = osa(`
    tell application "System Events"
      set frontProc to ${target}

      try
        set targetEl to ${targetEl}
        set children to UI elements of targetEl
        set n to count of children

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

          -- 用 return 换行，@@@@ 分隔字段
          set _line to i & "@@@@" & _role & "@@@@" & _title & "@@@@" & _desc & "@@@@" & _x & "@@@@" & _y & "@@@@" & _w & "@@@@" & _h & "@@@@" & _kids
          if i > 1 then set _json to _json & return
          set _json to _json & _line
        end repeat

        return _json
      on error err
        return "ERROR:" & err
      end try
    end tell`)

  if (raw.startsWith('ERROR:')) throw new Error(raw)

  let elements = raw.split('\r').filter(Boolean).map(line => {
    const [idx, role, title, desc, x, y, w, h, kids] = line.split('@@@@')
    return {
      index: parseInt(idx),
      role, title, desc,
      x: parseInt(x), y: parseInt(y), w: parseInt(w), h: parseInt(h),
      children: kids === 'true',
    }
  })

  // JS 侧过滤 role（大小写不敏感）
  if (opts?.filterRole) {
    elements = elements.filter(el =>
      el.role.toLowerCase().includes(opts.filterRole!.toLowerCase())
    )
  }

  return elements
}

function display(elements: any[]) {
  elements.forEach(el => {
    const arrow = el.children ? ' ▶' : ''
    const label = [el.title, el.desc].filter(s => s && s !== 'missing value').join(' · ')
    console.log(`  [${el.index}] ${el.role} |${label || '—'}| (${el.x},${el.y}) ${el.w}×${el.h}${arrow}`)
  })
  console.log(`  — 共 ${elements.length} 个`)
}

// ============================================================
// 测试 1：bundleId 定位 VS Code（区分同名的 Electron 应用）
// ============================================================
console.log('=== VS Code (bundleId=com.microsoft.VSCode) ===')
display(getUILevel({ bundleId: 'com.microsoft.VSCode' }))

// ============================================================
// 测试 2：微信只看按钮
// ============================================================
osa('tell application "WeChat" to activate')
execSync('sleep 1', { timeout: 5000 })

console.log('\n=== 微信 只看按钮 ===')
display(getUILevel({ appName: 'WeChat', filterRole: 'AXButton' }))

