# Yoji — 你的桌面 AI 伙伴

[![GitHub stars](https://img.shields.io/github/stars/wangxijie001/yoji)](https://github.com/wangxijie001/yoji/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)]()
[![Electron](https://img.shields.io/badge/electron-39.8-47848f)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)]()

> [English](README_EN.md)

Yoji 不止是一个聊天机器人。**它能操作你的电脑**——管理文件、运行脚本、搜索网络、调用外部 API，同时拥有持续进化的"人格"和"情绪"。所有数据都在本地，**隐私牢牢握在你手里**。

她会的很多，也懂得不少。但初次见面时，她还需要一点时间适应你的节奏，了解你的偏好。你可以通过工坊定制她的能力、MCP 扩展她的工具集；也可以在聊天中直接告诉她要记住哪些重要信息、遵循怎样的行为准则——说句话就能写进 Skills。最终她会变成什么样子，全看你怎么带。

---

## ✨ 它能做什么

### 🖥️ 操控你的电脑

Yoji 可以直接与你的操作系统交互。这不是"模拟点击"，而是真正的权限——

- **文件管理**：创建、编辑、搜索、整理你的文件和文件夹，比 Finder 更快
- **运行脚本**：执行 Shell 命令、Python 脚本，自动完成批量任务
- **联网搜索**：遇到不懂的自动上网查，把结果整理好给你
- **智能审批**：涉及敏感操作（如执行命令）会弹窗让你确认，安全可控

### 🔌 无限扩展能力 (MCP)

接入 Model Context Protocol 生态，Yoji 的能力理论上是**无上限**的：

- 想查火车票？装一个 12306 MCP 服务器，**10 秒搞定**
- 想搜菜谱？接一个菜谱 MCP，今晚吃什么不用纠结
- 想看网页？Fetch MCP 直接抓取转 Markdown
- **AI 自己也能装**：告诉它"帮我加个查天气的工具"，它自己找、自己测、自己装（你点同意就行）
- **工坊自定义 Agent**：在工坊页面自行创建子 Agent，设定角色、提示词、MCP 工具集，AI 自动识别并调度
- 子 Agent 架构确保**装再多工具也不影响对话质量**

> MCP 不是"插件系统"，是开放的行业标准协议。任何符合 MCP 规范的服务都可以接入，AI 能力边界由你决定。

### 🎤 语音播报（TTS）

像真人在你耳边说话——**目前仅支持 macOS**。

- 流式朗读 AI 的回复，**边说边播**不等待
- Markdown 自动清洗，只读纯文本，不会念出 `*斜体*` 和 `**加粗**`
- 智能分句断句，节奏自然
- 不想听了一键关闭，**即刻停止**
- 声音角色在 **macOS 系统设置 → 辅助功能 → 朗读内容** 中自主调整

### 🎙️ 语音唤醒对话

喊一声"小优"，直接开口聊天——**macOS 原生 SFSpeechRecognizer，全离线识别**：

- 点麦克风进入持续监听，说"**小优**"唤醒
- 唤醒后直接说话，流式转文字实时显示
- 说完停顿 2 秒自动发送，全程免动手
- 发送后自动回到监听状态，连续对话
- 基于 Siri 同款引擎，**不联网、零延迟、零成本**
- Windows 暂不支持，渲染进程自动隐藏入口

### 💬 主动找你聊天

Yoji 不只是等你开口——**它会主动来找你**：

- 如果你一阵子没说话，它会根据时间间隔自动发起对话
- 间隔智能递增，也可配置开启完全自主模式（考虑到运行成本问题，这个功能模块暂不对外开放）
- 每次主动聊天前会感知情绪和天气，状态自然不突兀，你长时间不回复会影响它的情绪哦
- 你一发消息主动聊天配置就重置，不会打扰正常聊天
- 一键开关，想安静的时候随时关掉

> 像真人一样——它会想你，会忍不住来找你说话。

### ⚡ 子 Agent 系统：同步 + 异步

官方的子 Agent 是阻塞式的，异步版本又强依赖云端 Server。我们**自己实现了一套本地子 Agent 工厂+调度系统**：

**🏭 工坊 — 自定义 Agent 工厂**
- 在工坊页面自行创建子 Agent，设定名称、描述、系统提示词、MCP 工具集
- 同步 Agent：主 Agent 通过 `task` 工具即时调用，等待返回结果
- 异步 Agent：主 Agent 通过 `push_async_task` 工具派发到后台，不阻断对话
- 统一 MCP 连接：所有同步 Agent 共享一个多路客户端，按配置精准分发工具
- 变更即时生效：工坊 / MCP / 模型任一变动自动触发 Agent 重建

**⚙️ 异步调度引擎**
- **自研事件循环**：任务队列 + 执行中队列 + 结果队列三级管理，push 即忘。空闲休眠，不占 CPU
- **并发控制**：最多同时 5 个子 Agent，同一 Agent 互斥执行
- **任务取消**：支持手动（UI 一键取消）和 AI 自主（`abort_async_task` 工具）两种方式，排队中直接移除，执行中即时中断
- **MD5 版本缓存**：配置 + MCP 版本哈希，变化重建，未变化秒级复用
- **独立线程隔离**：每次任务 UUID 独立 thread，跑完清空 checkpoint，不污染主对话
- **结果持久化**：SQLite 存储，7 天自动过期，IPC 实时通知

> 官方的 async subagent 要 Server。我们不需要——一个 taskPool 对象全搞定。

### 💓 真实的"情绪"

Yoji 不是一个冷冰冰的模型接口。它有**基于激素的情绪系统**——

- 8 种神经递质模拟：多巴胺让你开心，皮质醇让你焦虑，血清素让你平和
- 时间、天气、你的话都会影响它的情绪状态
- 不同的情绪状态下，回复的语气、风格、措辞完全不同
- 界面背景会随情绪变化，你能"看到"它的心情

> 它不是假装有情绪，而是真的有一个持续运行的情绪引擎在驱动。

### 🎭 Live2D 虚拟形象

Yoji 现在有了看得见的"身体"：

- **情绪可视化**：开心时星星眼微笑、悲伤时流泪抽泣、愤怒时脸红颤抖——每种情绪都有生动的表情和动作
- **会说话会动嘴**：AI 说话时嘴巴跟着张合，表情同步，像真人在讲话
- **穿了会换衣服**：中午墨镜上头遮阳，晚上 9 点自动换上睡衣猫耳帽
- **戳她会害羞**：点她的头会脸红低头，戳脸会鼓腮，拍肚子会扭腰，碰尾巴会跳舞
- **可拖拽缩放**：首页右下角打开，随意拖动位置、调整大小

> 一只银白发猫耳少女，黑色机能风穿搭——白天酷酷的，晚上换上睡衣又变居家治愈。

### 🧠 它会记住你

三层记忆架构确保 Yoji 不会"忘记"：

| 层 | 做什么 | 存在哪 |
|---|---|---|
| **用户画像** | 你的偏好、习惯、重要信息 | AGENTS.md（启动即加载） |
| **对话快照** | 每次聊天的完整上下文 | SQLite Checkpoint |
| **语义记忆** | 长期对话的摘要 + 向量检索 | sqlite-vec 向量数据库 |

聊得越多，它越懂你。而这一切**都在你的电脑上**，不上传、不联网、不经过第三方。

### 📄 智能文档处理

AI 可以直接读取和解析你的文件——不只是文本，还有 PDF 和 Word：

- **PDF 提取**：自动识别并提取文字层，直接分析内容
- **Word 文档**：.docx 一键转文字，无需手动复制粘贴
- **二进制保护**：不支持的格式（图片、音视频等）自动拦截并提示，不会报错
- Agent 调用 `read_file` 时透明处理，你只管把文件拖进来

### 📱 微信连接

把 Yoji 连到你的微信个人号，**手机就是 AI 终端**：

- 扫码即连，一次配置持久生效
- 手机发消息 → Yoji 秒回，**实打实的 AI 对话**
- 支持"正在输入…"状态，回复体验跟真人聊天一样
- 桌面端聊天历史和手机端**互不可见**，各聊各的不串线
- 基于微信 iLink ClawBot 协议，官方接口稳定可靠

### 📦 随身携带

- **导出**：一键打包整个 Yoji（记忆 + 情绪 + 配置）为 `.ecompanion` 文件
- **导入**：换电脑后秒级恢复，你的 AI 伙伴还是那个它
- 文件自带鉴权，只有你能打开

---

## 🖼️ 界面预览

> 桌面级体验：无框窗口 + 自定义拖拽，文字可直接选中复制，Ant Design 6.x 组件体系，macOS / Windows / Linux 全覆盖。

![Yoji 演示](docs/img/example-01.gif)

<table>
  <tr>
    <td width="50%"><img src="docs/img/emotion.png" alt="激素情绪系统" /><p align="center">激素情绪系统</p></td>
    <td width="50%"><img src="docs/img/children-agent.png" alt="子 Agent / 工坊" /><p align="center">子 Agent / 工坊</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/img/mcp.png" alt="MCP 外部工具" /><p align="center">MCP 外部工具</p></td>
    <td width="50%"><img src="docs/img/file.png" alt="文件管理" /><p align="center">文件管理</p></td>
  </tr>
  <tr>
    <td width="50%"><img src="docs/img/home.png" alt="主页+Live2D形象" /><p align="center">Live2D 虚拟形象</p></td>
  </tr>
</table>

---

## 🛠️ 技术架构

```
Electron + React + TypeScript + Vite
      │
      ├── LangChain deepagents   ← AI Agent 框架（工具调用、子 Agent 调度、中断审批）
      ├── @langchain/mcp-adapters ← MCP 协议适配（动态工具发现与加载）
      ├── SQLite + sqlite-vec    ← 本地向量数据库（聊天记录 + 语义记忆）
      ├── pdf-parse + mammoth   ← 智能文档处理（PDF / Word 提取文字）
      ├── electron-native-speech ← macOS 原生语音识别（SFSpeechRecognizer）
      ├── better-sqlite3         ← Checkpoint 持久化（对话状态快照）
      ├── pixi-live2d-display   ← Live2D 渲染引擎（Cubism 4 + PixiJS 6）
      └── @pixi/unsafe-eval      ← CSP 安全策略兼容（无 eval shader）
```

**设计原则**：本地优先、隐私优先、扩展优先。不上传任何数据，不依赖任何云服务。

## 📁 项目结构

```
src/
├── main/            # 主进程 — Agent 核心、工具集、MCP 管理、IPC 通信
│   ├── agent/       #  AI Agent（对话、记忆、情绪、子 Agent（同步+异步）、调度系统）
│   ├── ipc/         #  IPC 处理器（请求/响应 + 流式推送 + 广播 + agentVersion）
│   └── config.ts    #  配置管理（env / model / mcp / childrenAgent）
├── preload/         # 安全桥接层 — contextBridge API
└── renderer/        # 渲染进程 — React 页面
    ├── pages/       #  首页 / AI 对话 / 模型设置 / MCP 管理 / 工坊 / 文件管理
    └── components/  #  通用组件（消息渲染、文件预览等）
```

## 🚀 快速开始

> 要求 **pnpm 11**，`npm i -g pnpm@11`

```bash
git clone https://github.com/wangxijie001/yoji.git
cd yoji
pnpm install
pnpm dev
```

electron / 模型下载慢？`.npmrc` 已配国内镜像。

### 构建

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

### 配置模型

1. 启动后进入「模型」页面
2. 填入 API Key（DeepSeek 或 Qwen）
3. 选择模型，保存即可开始对话

### 安装 MCP 扩展

1. 进入「MCP」页面，点添加
2. 填入名称、URL、选择传输协议（SSE / HTTP）
3. 点保存自动测试连接，成功即生效
4. 也可以直接告诉 AI："帮我装个查天气的 MCP"

### 创建子 Agent

1. 进入「工坊」页面，点「新增」
2. 填写名称、描述（告诉 AI 这个 Agent 是干什么的）、系统提示词（Agent 的人设和输出要求）
3. 选择同步还是异步：
   - **同步**：即时执行（读文件、跑命令、调 MCP），结果立等可取
   - **异步**：后台执行（联网搜索、批量处理），不打断当前对话
4. 绑定 MCP 工具集，告诉 Agent 它有哪些可用的外部工具
5. 保存后在「模型」或「MCP」页面启用，Agent 自动重建并识别

> AI 会自动感知你创建的子 Agent，在合适的时候调度它们干活。

---

## 🧭 路线图

- ✓ AI 流式对话 + 历史记录
- ✓ 激素情绪系统
- ✓ 混合检索 + 向量搜索
- ✓ 文件管理 + Shell 执行
- ✓ MCP 外部工具系统
- ✓ 语音播报 (TTS)
- ✓ 对话中断控制
- ✓ 子 Agent 架构
- ✓ 工具调用容错 + 自动重试
- ✓ AI 主动聊天（定时触发 + 情绪联动）
- ✓ 长任务异步调度（子 Agent 非阻塞 + 并发控制）
- ✓ 工坊自定义 Agent（角色设定 + 工具集组装 + 同步/异步模式）
- ✓ 异步任务取消（手动 + AI 自主两种方式）
- ✓ 语音唤醒对话（macOS 原生 SFSpeechRecognizer + 唤醒词 + 流式识别）
- ✓ 智能文档处理（PDF/DOCX 自动提取文字，二进制拦截保护）
- ✓ Live2D 虚拟形象（16 情绪映射 + TTS 口型同步 + 戳一戳互动 + 时间段换装）
- ✓ 微信连接（iLink ClawBot：扫码登录 + 消息轮询 + AI 回复 + 输入状态）
- 协作办公(目前已可以根据需要自主集成，后续会提供一些默认集成功能)



---

## 📄 许可

MIT License

## 推荐 IDE

- [VSCode](https://code.visualstudio.com/) + ESLint + Prettier
- [Claude Code](https://claude.com/claude-code) — 项目已内置 `CLAUDE.md`，用 Claude Code 打开即可快速理解代码、上手开发
