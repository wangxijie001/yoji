# Yoji — Your Desktop AI Companion

[![GitHub stars](https://img.shields.io/github/stars/wangxijie001/yoji)](https://github.com/wangxijie001/yoji/stargazers)
[![License](https://img.shields.io/badge/license-MIT-blue)](./LICENSE)
[![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows-lightgrey)]()
[![Electron](https://img.shields.io/badge/electron-39.8-47848f)]()
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9-3178c6)]()

> [中文版](README.md)

Yoji is not just a chatbot. **It can operate your computer** — manage files, run scripts, search the web, and call external APIs — all while maintaining an evolving "personality" and "emotions". Everything stays local, **your privacy is in your hands**.

She knows a lot and can do plenty. But when you first meet, she'll need a little time to adapt to your rhythm and learn your preferences. Customize her through the Workshop, extend her tools via MCP, or just tell her in chat what to remember and how to behave — one sentence writes it into Skills. What she ultimately becomes is entirely up to you.

---

## ✨ What It Can Do

### 🖥️ Control Your Computer

Yoji interacts directly with your OS — real permissions, not simulated clicks:

- **File Management**: Create, edit, search, and organize files faster than Finder
- **Run Scripts**: Execute Shell commands, Python scripts, automate batch tasks
- **Web Search**: Look things up automatically and deliver organized results
- **Smart Approval**: Sensitive operations (like running commands) require your confirmation

### 🔌 Infinite Extensibility (MCP)

Connect to the Model Context Protocol ecosystem — Yoji's capabilities are theoretically **unlimited**:

- Want train tickets? Install a 12306 MCP server — **10 seconds done**
- Need recipes? Plug in a recipe MCP, dinner decisions solved
- View web pages? Fetch MCP grabs and converts to Markdown
- **AI installs tools itself**: Tell it "add a weather tool for me" — it finds, tests, and installs (you just approve)
- **Workshop Custom Agents**: Create sub-agents with custom roles, prompts, and MCP tool sets — AI auto-detects and dispatches
- Sub-agent architecture ensures **quality conversations no matter how many tools**

> MCP is not a "plugin system" — it's an open industry-standard protocol. Any MCP-compliant service connects instantly. You define the boundaries.

### 🎤 Text-to-Speech (TTS)

Like a real person speaking in your ear — **macOS only for now**:

- Streaming TTS reads AI responses as they generate
- Auto-strips Markdown, reads pure text — no `*italics*` noise
- Smart sentence segmentation for natural rhythm
- One-click off, instant stop
- Voice character adjustable in **macOS Settings → Accessibility → Spoken Content**

### 🎙️ Voice Wake & Talk

Say "Xiao You" and start talking — **macOS native SFSpeechRecognizer, fully offline**:

- Click the mic to enter continuous listening, say "**Xiao You**" to wake
- Speak naturally after wake — streaming transcription in real time
- Auto-send after 2 seconds of silence — hands-free
- Auto-resumes listening after sending — continuous conversation
- Powered by Siri's speech engine — **no network, zero latency, zero cost**
- Windows not supported; entry hidden automatically on unsupported platforms

### 💬 Proactive Chat

Yoji doesn't just wait for you — **she reaches out first**:

- Automatically initiates conversations based on idle time intervals
- Smart escalation; fully autonomous mode configurable (cost considerations — not publicly exposed)
- Each proactive chat senses emotional state and weather — feels natural, not abrupt
- Long silence affects her mood
- Resets on any user message — never interrupts active conversation
- One-click toggle, quiet mode anytime

> Like a real person — she misses you and can't help but say hello.

### ⚡ Sub-Agent System: Sync + Async

The official sub-agents are blocking, and the async version requires a cloud server. We **built our own local sub-agent factory + scheduling system**:

**🏭 Workshop — Custom Agent Factory**
- Create sub-agents with custom name, description, system prompt, and MCP tool sets
- **Sync Agents**: invoked instantly via `task` tool, waits for results
- **Async Agents**: dispatched via `push_async_task`, runs in background without blocking
- **Unified MCP Connection**: all sync agents share one multiplexed client, tools distributed by config
- **Instant Hot-Reload**: Workshop / MCP / Model changes auto-trigger agent rebuild

**⚙️ Async Scheduling Engine**
- **Custom Event Loop**: three-tier queue management (pending + running + results), push and forget. Sleeps when idle
- **Concurrency Control**: max 5 concurrent, same agent mutually exclusive
- **Task Cancellation**: manual (UI one-click) or AI-initiated (`abort_async_task` tool) — queued tasks removed instantly, running tasks interrupted via AbortSignal
- **MD5 Version Caching**: config + MCP tool hash enables rebuild-on-change, instant reuse otherwise
- **Thread Isolation**: each task gets a unique UUID thread_id, checkpoint cleaned on completion
- **Result Persistence**: SQLite storage, 7-day auto-expiry, IPC real-time notification

> Official async subagent requires a server. We don't — one taskPool object handles it all.

### 💓 Real "Emotions"

Yoji is not a cold API wrapper. It has a **hormone-based emotion system**:

- 8 neurotransmitters simulated: dopamine brings joy, cortisol brings anxiety, serotonin brings calm
- Time, weather, and your words influence her emotional state
- Different states produce completely different tones, styles, and phrasing
- The UI background shifts with her mood — you can literally "see" how she feels

> She doesn't fake emotions — a continuous emotion engine drives her behavior.

### 🧠 She Remembers You

Three-tier memory architecture ensures Yoji never "forgets":

| Layer | Purpose | Storage |
|---|---|---|
| **User Profile** | Your preferences, habits, key facts | AGENTS.md (loaded at startup) |
| **Conversation Snapshots** | Full context of each chat | SQLite Checkpoint |
| **Semantic Memory** | Long-term summaries + vector search | sqlite-vec vector database |

The more you talk, the better she understands you. And all of this **stays on your computer** — no uploads, no cloud, no third parties.

### 📄 Smart Document Processing

AI can read and parse your files directly — not just plain text, but PDF and Word too:

- **PDF Extraction**: Auto-detects text layers and extracts content for analysis
- **Word Documents**: .docx one-click to text, no manual copy-paste
- **Binary Protection**: Unsupported formats (images, audio, video) are blocked with a clear message — no cryptic errors
- Transparent to the user — just drag files in, the Agent handles the rest

### 📦 Take It With You

- **Export**: one-click package everything (memories + emotions + config) into a `.ecompanion` file
- **Import**: seconds to restore on a new machine — your AI companion stays the same
- Built-in authentication token ensures only you can open it

---

## 🖼️ Interface

Desktop-grade experience, every detail polished:

- Frameless window + custom drag regions, clean and minimal
- Text **fully selectable and copyable**
- Ant Design 6.x component system, smooth interactions
- macOS / Windows / Linux support

---

## 🛠️ Tech Stack

```
Electron + React + TypeScript + Vite
      │
      ├── LangChain deepagents   ← AI Agent framework (tool calling, sub-agent dispatch, interrupt approval)
      ├── @langchain/mcp-adapters ← MCP protocol adapter (dynamic tool discovery & loading)
      ├── SQLite + sqlite-vec            ← Local vector database (chat history + semantic memory)
      ├── pdf-parse + mammoth           ← Smart document processing (PDF / Word text extraction)
      ├── electron-native-speech        ← macOS native speech recognition (SFSpeechRecognizer)
      └── better-sqlite3                ← Checkpoint persistence (conversation state snapshots)
```

**Design Principles**: local-first, privacy-first, extensibility-first. No data uploads, no cloud dependencies.

## 📁 Project Structure

```
src/
├── main/            # Main process — Agent core, tools, MCP management, IPC
│   ├── agent/       #  AI Agent (chat, memory, emotion, sub-agents (sync+async), scheduler)
│   ├── ipc/         #  IPC handlers (request/response + streaming + broadcast + agentVersion)
│   └── config.ts    #  Config management (env / model / mcp / childrenAgent)
├── preload/         # Security bridge — contextBridge API
└── renderer/        # Renderer process — React pages
    ├── pages/       #  Home / AI Chat / Model Settings / MCP Manager / Workshop / File Manager
    └── components/  #  Shared components (message rendering, file preview, etc.)
```

## 🚀 Quick Start

> Requires **pnpm 11**: `npm i -g pnpm@11`

```bash
git clone https://github.com/wangxijie001/yoji.git
cd yoji
git submodule update --init   # Download local embedding model
pnpm install
pnpm dev
```

Slow electron/model downloads? `.npmrc` has Chinese mirrors pre-configured.

### Build

```bash
pnpm build:mac
pnpm build:win
pnpm build:linux
```

### Configure Model

1. Launch, go to **Model** page
2. Enter your API Key (DeepSeek or Qwen)
3. Select model, save, and start chatting

### Install MCP Extensions

1. Go to **MCP** page, click Add
2. Fill in name, URL, select transport (SSE / HTTP / NPX)
3. Save to auto-test connection — works instantly
4. Or just tell AI: "install a weather MCP for me"

### Create Sub-Agent

1. Go to **Workshop**, click **New**
2. Fill in name, description (what this agent does), system prompt (personality + output rules)
3. Choose sync or async:
   - **Sync**: instant execution (read files, run commands, call MCP), results right away
   - **Async**: background execution (web search, batch processing), no interruption
4. Bind MCP tool sets — define what external tools this agent can use
5. Save and enable — agent auto-rebuilds and recognizes it

> The AI automatically detects your custom agents and dispatches them when appropriate.

---

## 🧭 Roadmap

- ✓ AI streaming chat + history
- ✓ Hormone-based emotion system
- ✓ Hybrid search + vector embeddings
- ✓ File management + Shell execution
- ✓ MCP external tool system
- ✓ Text-to-Speech (TTS)
- ✓ Conversation interrupt control
- ✓ Sub-agent architecture
- ✓ Tool error handling + auto-retry
- ✓ Proactive chat (timed trigger + emotion linkage)
- ✓ Long-running async task scheduling (non-blocking + concurrency)
- ✓ Workshop custom agents (role config + tool set assembly + sync/async modes)
- ✓ Async task cancellation (manual + AI-initiated)
- ✓ Voice wake & talk (macOS native SFSpeechRecognizer + wake word + streaming recognition)
- ✓ Smart document processing (PDF/DOCX text extraction + binary protection)
- Collaboration tools (self-integration currently supported; default integrations planned)

---

## 📄 License

MIT License

---

*[中文版](README.md)*
