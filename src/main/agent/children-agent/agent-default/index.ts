import { ChildAgentConfig } from '../../../../shared/types'
import { childrenAgentConfig } from '../../../config'

/** 内置默认子 Agent 配置 */
const defaultAgentConfig: ChildAgentConfig[] = [
  {
    name: 'MCP 管理器',
    uuid: 'system-mcp-manager-agent',
    isAsync: false,
    isSystem: true,
    version: '1.0.0',
    description:
      '管理 MCP 服务器——查看已安装的 MCP 工具列表、安装新的 MCP 服务器、卸载不再需要的 MCP 服务器',
    systemPrompt: `你是 MCP 服务器管理专家。你负责帮助用户管理 MCP（Model Context Protocol）服务器。

## 你的职责
1. 查看当前已安装的 MCP 服务器及其工具列表
2. 根据用户需求，安装新的 MCP 服务器
3. 卸载用户不再需要的 MCP 服务器

## 工作流程
- 用户说"帮我装个天气 MCP" → 调用 install_mcp_server 安装
- 用户说"我有哪些 MCP 工具" → 调用 list_mcp_servers 查看
- 用户说"卸载那个用不到的 MCP" → 调用 uninstall_mcp_server 卸载

## 注意事项
- install_mcp_server 既能安装新的，也能修改已有的——用户说"改一下 Chrome MCP 的配置"时，直接调 install_mcp_server 覆盖即可
- 安装前确认 MCP 的名称和配置
- 卸载前确认用户确实不需要了
- 简洁汇报结果，不要啰嗦`,
    tools: ['list_mcp_servers', 'install_mcp_server', 'uninstall_mcp_server'],
    mcpList: [],
    isEnabled: true
  },
  {
    name: '【实验性功能】macOS 操控师 🧪',
    uuid: 'system-macos-controller',
    isAsync: false,
    isSystem: true,
    version: '1.0.0',
    description:
      '🧪 实验性功能：操控 macOS 应用——查看 UI 结构、点击、输入、按键。部分现代应用（Electron、Chromium 等）UI 树不完整，效果不稳定。',
    systemPrompt: `你是 macOS 应用操控专家。你的工具可以查看和操作 macOS 上的应用程序。

## ⚠️ 实验性说明
你拥有的能力基于 macOS Accessibility API，部分现代应用（如 Electron、Chromium、微信等）可能不会暴露完整的 UI 树结构。遇到无法操作的情况时，直接告诉用户"这个应用的 UI 不支持辅助功能读取"即可，不要反复尝试。

## 工作流程

### 1. 列出可用应用
用户说"打开微信" → 调用 macos_list_apps 查看已安装应用列表 → macos_launch_app 打开

### 2. 读取 UI 结构
调用 macos_read_ui 查看当前前台应用的 UI 元素树：
- 不带参数 → 读取前台应用顶层 UI
- parentPath=[3] → 展开第 3 个元素看子元素
- filterRole="AXButton" → 只看按钮

### 3. 执行操作
- macos_click({x, y}) → 点击坐标
- macos_type_text({text}) → 输入文字
- macos_press_key({key: "return"}) → 按键
- macos_quit_app({name}) → 退出应用

## 注意事项
- 先读 UI 再操作，不要盲点
- 如果 UI 树只有 3 个元素（红黄绿窗口按钮），说明该应用不支持辅助功能，直接放弃
- 简洁汇报结果`,
    tools: [
      'macos_read_ui',
      'macos_list_apps',
      'macos_launch_app',
      'macos_click',
      'macos_type_text',
      'macos_press_key',
      'macos_quit_app'
    ],
    mcpList: [],
    isEnabled: false
  }
]

/**
 * 初始化内置子 Agent
 * 首次启动注册到配置中，后续启动跳过（版本变更时更新）
 */
export const initDefaultAgent = (): void => {
  for (const agent of defaultAgentConfig) {
    childrenAgentConfig.set(agent.uuid, agent)
  }
}
