# DeepAgents Skills 系统

> 可复用行为片段，`SKILL.md` 格式，按需加载避免上下文膨胀。
>
> 需要 `deepagents >= 1.7.0`

---

## 一、核心概念

### Skills 是什么

Skills 是**按需加载的 Agent 能力包**。每个 Skill 是一个目录，其中必须包含 `SKILL.md` 文件，可选包含辅助脚本、参考文档、模板等资源。

```
my-skill/
├── SKILL.md          # 必需：YAML frontmatter + Markdown 指令
├── reference.md      # 可选：参考文档
├── scripts/          # 可选：辅助脚本
│   └── helper.py
└── assets/           # 可选：模板等资源
```

### Skills vs Memory

| 对比 | `memory` 文件 (AGENTS.md) | `skills` 文件 (SKILL.md) |
|---|---|---|
| 加载方式 | 启动时**全量注入** | **渐进式加载**（先元数据，按需加载正文） |
| 内容定位 | "你是谁"、"记住什么" | "怎么做" |
| Token 消耗 | 始终占用上下文 | 仅在相关时加载 |
| 格式 | 单一 Markdown 文件 | 目录 + `SKILL.md` + 可选资源 |
| 最佳用途 | 编码风格、用户画像、全局规则 | 工作流模板、领域知识、参考文档 |
| 大小限制 | 必须精简，否则爆上下文 | 可以很长（正文最多 10MB） |

---

## 二、渐进式披露（Progressive Disclosure）

Skills 的核心设计原则：**Agent 只加载需要的内容，而非一次性全部注入**。

### 三层加载架构

| 层级 | 内容 | 加载时机 | Token 消耗 |
|------|------|----------|------------|
| **第 1 层** | YAML frontmatter（name + description） | Agent 启动时预加载到 system prompt | 极小（几百 token） |
| **第 2 层** | `SKILL.md` 完整正文 | Agent 判断技能匹配当前任务后，通过 `read_file` 读取 | 适中 |
| **第 3 层** | 附加文件（reference.md、脚本等） | 特定场景按需加载 | 视需要 |

### 流程示意

```
Agent 启动
    │
    ▼
SkillsMiddleware 扫描所有 skills 目录
    │
    ▼
提取每个 SKILL.md 的 frontmatter（name + description）
    │
    ▼
注入 system prompt（仅元数据列表）
    │
    ▼
用户提问 → Agent 判断是否匹配某个 Skill
    │
    ├── 不匹配 → 忽略，不消耗额外 token
    │
    └── 匹配 → Agent 调 read_file 读取 SKILL.md 正文
                  │
                  ▼
               按需加载第三层资源
```

**优势**：
- 大幅节省 token（默认只加载几百 token 的元数据）
- 降低 LLM 认知负荷
- 支持大量 Skills 同时注册而不会炸上下文

---

## 三、SKILL.md 文件格式

### 完整格式

每个 `SKILL.md` 由两部分组成：

1. **YAML frontmatter**（元数据）
2. **Markdown 正文**（Agent 指令）

```markdown
---
name: langgraph-docs
description: Use this skill for requests related to LangGraph documentation, API references, how-to guides, and conceptual explanations. Covers LangGraph v0.x-v1.x, including all agent architectures, streaming modes, checkpointer patterns, and deployment guides.
license: MIT
compatibility: Requires internet access for fetching documentation URLs
metadata:
  author: langchain
  version: "1.0"
allowed-tools: fetch_url
module: index.ts
---

# LangGraph Documentation Skill

## Overview
This skill provides the agent with knowledge about LangGraph...

## When to Use
- User asks about LangGraph concepts or API
- User wants to understand agent architectures
- User needs help with streaming, checkpointing, or deployment

## Instructions
1. First, identify the LangGraph topic the user is asking about
2. Use `fetch_url` to retrieve the relevant documentation page
3. Summarize the key points in a clear, concise manner
4. Provide code examples where applicable
```

### Frontmatter 字段详解

| 字段 | 必需 | 类型 | 说明 |
|------|------|------|------|
| `name` | ✅ 必需 | string | 唯一标识符，小写字母/数字/连字符，最长 64 字符。**必须与目录名一致** |
| `description` | ✅ 必需 | string | 技能描述，最长 1024 字符。**写"何时使用"而非"做什么"** |
| `license` | 可选 | string | 许可证信息 |
| `compatibility` | 可选 | string | 兼容性说明（如需要的网络访问、模型要求等） |
| `metadata` | 可选 | object | 自由键值对（如 author、version） |
| `allowed-tools` | 可选 | string | 逗号分隔的工具列表，**实验性功能**，当前仅作为提示注入，非强制门控 |
| `module` | 可选 | string | 入口模块文件名（用于 Code Interpreter 技能） |

### description 编写指南

**核心原则**：写"何时使用"，而非"做什么"。

- ❌ **差的描述**："Helps with email"
- ✅ **好的描述**："Use when drafting, replying to, or summarizing emails. Covers tone adjustment, follow-up scheduling, and inbox triage."

- ❌ **差的描述**："Manages code reviews"
- ✅ **好的描述**："Use when reviewing pull requests, checking for bugs, security vulnerabilities, code style violations, or performance issues. Provides structured feedback with severity levels."

**注意**：
- description 超 1024 字符会被截断
- 描述太宽泛会导致路由失败和 Skill 间重叠
- 保持描述具体、场景化

### 正文编写建议

1. **保持聚焦**：单一工作流或领域，避免大而全的 Skill
2. **引用辅助文件**：在正文中明确提及可用的辅助文件，Agent 才能知道它们存在
3. **提供清晰指令**：分步骤、有示例，Agent 更容易执行
4. **把全局偏好放 memory**：始终生效的规则放 `AGENTS.md`，特定任务的放 Skill
5. **正文最大 10MB**：超大文件会被自动跳过（DoS 防护）

---

## 四、配置方式

### 基本配置

```ts
import { createDeepAgent, FilesystemBackend } from 'deepagents'

const agent = await createDeepAgent({
  model: 'claude-sonnet-4-5-20250929',
  backend: new FilesystemBackend({ rootDir: '.', virtualMode: true }),
  skills: ['./skills/'],  // 传递 skills 参数，自动启用 SkillsMiddleware
})
```

**关键点**：
- 只需传 `skills` 数组，框架**自动**添加 `SkillsMiddleware`
- **不要**同时在 `middleware` 数组中手动添加 `SkillsMiddleware`，否则会重复注入 system prompt
- Skill 路径是相对于 Backend root 的**虚拟 POSIX 路径**

### 配置 StateBackend（内存中注入 Skills）

Skills 文件可以通过 `files` 参数预先注入到 StateBackend：

```ts
import { createDeepAgent, type FileData } from 'deepagents'
import { MemorySaver } from '@langchain/langgraph'

function createFileData(content: string): FileData {
  const now = new Date().toISOString()
  return {
    content: content.split('\n'),
    created_at: now,
    modified_at: now,
  }
}

// 从远程获取 Skill 内容
const skillUrl = 'https://raw.githubusercontent.com/.../SKILL.md'
const response = await fetch(skillUrl)
const skillContent = await response.text()

const skillsFiles: Record<string, FileData> = {
  '/skills/langgraph-docs/SKILL.md': createFileData(skillContent),
}

const agent = await createDeepAgent({
  skills: ['/skills/'],
  checkpointer: new MemorySaver(),
})

const result = await agent.invoke(
  {
    messages: [{ role: 'user', content: 'What is LangGraph?' }],
    files: skillsFiles,  // StateBackend 虚拟文件注入
  },
  { configurable: { thread_id: 'session-1' } }
)
```

### 多 Source 与优先级

多个 Skill 源按顺序加载，**同名 Skill 以后者覆盖前者**：

```ts
skills: [
  '/skills/base/',     // 基础 Skills（优先级最低）
  '/skills/user/',     // 用户自定义（覆盖基础）
  '/skills/project/',  // 项目专用（优先级最高）
]
```

如果 `/skills/base/` 和 `/skills/project/` 都包含 `code-review` Skill，最终生效的是 `/skills/project/code-review/`。

### Skill 发现路径（社区规范）

Agent 运行时会按以下顺序查找 Skills：

```
~/.deepagents/<agent_name>/skills/   # Agent 专属
~/.agents/skills/                     # 用户全局
.deepagents/skills/                    # 项目 (deepagents 格式)
.agents/skills/                        # 项目 (agents 格式)
.claude/skills/                        # Claude Code 兼容（实验性）
```

---

## 五、Subagent 中使用 Skills

### 基本配置

Subagent **不继承**主 Agent 的 Skills，需要显式配置：

```ts
const researchSubagent: SubAgent = {
  name: 'researcher',
  description: 'Research assistant with specialized skills',
  systemPrompt: 'You are a researcher.',
  tools: [webSearch],
  skills: ['/skills/research/', '/skills/web-search/'],  // subagent 专属 Skills
}
```

### 通用 Subagent vs 自定义 Subagent

| Subagent 类型 | Skills 继承 |
|---------------|-------------|
| **通用 Subagent**（未指定 skills） | 自动继承主 Agent 的 Skills |
| **自定义 Subagent**（指定了 skills） | 仅使用显式配置的 Skills |

### Subagent 最佳实践

- **利用 Subagent 做工具隔离**：每个 Skill 可以建模为独立 Subagent，拥有自己的 `tools` 列表
- **父 Agent 看不到子 Agent 的专属工具**，反之亦然——天然的权限边界
- **要求 Subagent 返回 500 字以内的摘要**，避免上下文膨胀
- **不要递归嵌套**：Subagent 内部不应再使用 `SubAgentMiddleware`

---

## 六、allowed-tools 与工具隔离

### 当前状态：实验性

`allowed-tools` 字段目前**仅作为提示文本注入**到 system prompt 中：

```
Allowed tools: fetch_url, read_file
```

SkillsMiddleware **不会**在工具调用时进行拦截或强制检查。当前仅作为给 LLM 的建议。

### 实现真正的工具隔离

两种方案：

**方案一：Subagent 模式（推荐）**

```ts
const skillAsSubagent: SubAgent = {
  name: 'code-reviewer',
  description: 'Code review specialist',
  systemPrompt: 'You review code for bugs and style issues.',
  tools: [readFile, grep],  // 只能使用这些工具
  skills: ['/skills/code-review/'],
}
```

框架层面强制隔离——Subagent 无法访问父 Agent 的工具列表。

**方案二：自定义 Middleware（高级）**

通过 `ModelRequest.override(tools=...)` 在运行时动态调整工具列表，需要模型显式调用 `begin_skill` / `end_skill` 工具来标记 Skill 边界。

---

## 七、中间件执行顺序

SkillsMiddleware 在中间件栈中的位置：

```
1. TodoListMiddleware          ← 任务规划
2. SkillsMiddleware            ← Skills 元数据注入（在这里！）
3. FilesystemMiddleware        ← 文件工具注册
4. SubAgentMiddleware          ← Subagent 调度
5. SummarizationMiddleware     ← 自动摘要
6. PatchToolCallsMiddleware    ← 修复中断的工具调用
7. AnthropicPromptCachingMiddleware ← 缓存优化
8. MemoryMiddleware            ← 记忆注入（AGENTS.md）
9. HumanInTheLoopMiddleware    ← 人工审批
```

SkillsMiddleware 在 FilesystemMiddleware **之前**执行，这样 Agent 在获得文件读写能力之前就已经知道了有哪些 Skills 可用。

---

## 八、落地到本项目

### 当前状态

`project-mapping.md` 中标注为 **📋 规划中**。

### 落地路径建议

```
src/main/agent/
├── skills/                     ← 新建：伴侣行为 Skill 目录
│   ├── emotion-analyze/        ← 情绪分析 Skill
│   │   └── SKILL.md
│   ├── memory-recall/          ← 记忆回溯 Skill
│   │   └── SKILL.md
│   └── daily-summary/          ← 每日总结 Skill
│       └── SKILL.md
├── index.ts                    ← 修改：添加 skills: [...] 配置
...
```

```ts
// src/main/agent/index.ts
import { join } from 'node:path'

const SKILLS_DIR = join(__dirname, 'skills')  // 或 userData 目录

const agent = createDeepAgent({
  model,
  backend: new FilesystemBackend({ rootDir: COMPANION_DIR, virtualMode: true }),
  memory: [AGENTS_MD_PATH],
  skills: [SKILLS_DIR],  // 新增：启用 Skills 系统
  checkpointer,
})
```

### 注意事项

1. **Backend 必须能访问 Skill 文件**——确保路径配置正确
2. **不要手动添加 SkillsMiddleware**——传 `skills` 参数后框架自动添加
3. **description 决定路由质量**——花时间写好描述，Agent 才能准确匹配
4. **和 hormone 情绪系统配合**——Skills 可以作为情绪驱动的行为模板载体

---

## 九、参考资料

| 资源 | 链接 |
|---|---|
| Skills 官方文档 | https://docs.langchain.com/oss/javascript/deepagents/skills |
| Customize Deep Agents | https://docs.langchain.com/oss/javascript/deepagents/customization |
| Content Builder 示例 | https://docs.langchain.com/oss/javascript/deepagents/content-builder |
| Memory and Skills | https://docs.langchain.com/oss/javascript/deepagents/code/memory-and-skills |
| CreateDeepAgentParams API | https://reference.langchain.com/javascript/deepagents/types/CreateDeepAgentParams |
| deepagentsjs 源码 | https://github.com/langchain-ai/deepagentsjs |
