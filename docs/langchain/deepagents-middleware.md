# DeepAgents 中间件与扩展

## 中间件

在 Agent 生命周期中插入自定义逻辑：

```ts
const agent = createDeepAgent({
  middleware: [loggingMiddleware, permissionMiddleware],
})
```

## Skills 系统

可复用行为片段，`SKILL.md` 格式，渐进式披露避免上下文膨胀。

> 📖 详见 [deepagents-skills.md](deepagents-skills.md) —— 完整的格式规范、配置方式、Subagent 集成和落地指南。

### 快速概览

```
my-skill/
├── SKILL.md          # 必需：YAML frontmatter + Markdown 指令
├── reference.md      # 可选：参考文档
└── scripts/          # 可选：辅助脚本
```

**三层渐进加载**：
1. Agent 启动 → 只加载 frontmatter 元数据（几百 token）
2. 匹配任务 → Agent 调 `read_file` 读取完整 SKILL.md
3. 深入使用 → 按需加载辅助文件

**配置**：传 `skills` 数组即可，框架自动添加 SkillsMiddleware（不要手动重复添加）。

## Human-in-the-loop（工具审批）

通过 `interruptOn` 参数配置哪些工具需要在执行前等待用户审批。**需要 checkpointer**。

### 基本用法

```ts
const agent = createDeepAgent({
  model,
  tools: toolList,
  backend: new LocalShellBackend({ ... }),
  checkpointer: getCheckpointer(),  // ← 必需
  interruptOn: {
    execute: true,    // 默认：允许 approve、edit、reject、respond
  },
})
```

### 审批决策类型

| 决策 | 含义 |
|------|------|
| `approve` | 批准，工具正常执行 |
| `edit` | 修改参数后执行 |
| `reject` | 拒绝，工具不执行 |
| `respond` | 替换为自定义响应文本 |

### 限制决策选项

```ts
interruptOn: {
  execute: {
    allowedDecisions: ['approve', 'reject'],  // 只允许批准或拒绝
  },
  write_file: false,  // 明确禁用中断
}
```

### 条件中断（按需触发）

```ts
interruptOn: {
  execute: {
    allowedDecisions: ['approve', 'reject'],
    when: (request) => {
      // 只拦截含危险关键字的命令
      const cmd = request.toolCall.args.command || ''
      return /rm\s+-rf|sudo|chmod/.test(cmd)
    },
  },
}
```

### 流式输出中的中断事件

当工具触发中断时，stream 中会出现 `__interrupt__` 事件，我们已在 `src/main/ipc/agent.ts` 的流式处理中对接：

```ts
// __interrupt__ 事件格式
{
  actionRequests: [{ name: 'execute', args: { command: '...' } }],
  reviewConfigs: [{ actionName: 'execute', allowedDecisions: ['approve', 'reject'] }],
}
```

前端通过 `requires_approval` 类型的 chunk 接收并展示审批 UI。

## FilesystemPermission（文件权限规则）

声明式文件系统权限，控制 Agent 能读/写哪些路径。**JS 版仅支持 `allow` / `deny`。**

```ts
import { createDeepAgent, type FilesystemPermission } from 'deepagents'

const permissions: FilesystemPermission[] = [
  {
    operations: ['write'],           // 'read' | 'write'
    paths: ['/secrets/**'],          // glob 模式，必须绝对路径
    mode: 'deny',                    // 'allow' | 'deny'
  },
  {
    operations: ['read', 'write'],
    paths: ['/workspace/**'],
    mode: 'allow',
  },
]

const agent = createDeepAgent({
  // ...
  permissions,
})
```

**规则评估**：
- 按声明顺序依次匹配，**先匹配先生效**
- 未匹配到任何规则时，**默认允许**（permissive default）
- `operations`：`read` 涵盖 `ls`/`read_file`/`glob`/`grep`，`write` 涵盖 `write_file`/`edit_file`
- 不支持 Python 版的 `mode: "interrupt"`（JS 版用 `interruptOn` 代替）

> ⚠️ `execute` 不受 FilesystemPermission 约束，因为 Shell 命令可以访问任意路径。如需限制 execute，请使用 `interruptOn`。

## 其他扩展点

| 扩展 | 说明 |
|------|------|
| MCP Server | 通过 `@langchain/mcp-adapters` 接入 MCP Server 作为工具源 |
| 自定义 Backend | 实现自己的文件系统后端，实现 `BackendProtocol` 接口 |
| 自定义 Tool | 标准 LangChain `tool()` 即可，无特殊要求 |
| 多模态 | 读图片、PDF、音频 |
| Code Interpreter | LocalShellBackend 的 execute 可运行脚本 |
