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

## Human-in-the-loop

工具执行前需用户审批：

```ts
// 配置审批规则
const agent = createDeepAgent({
  interruptOn: { tools: ['delete_file', 'execute_command'] },
})
// Agent 会暂停等待用户确认
```

## 其他扩展点

| 扩展 | 说明 |
|---|---|
| MCP Server | 接入任何 MCP Server 作为工具源 |
| 自定义 Backend | 实现自己的文件系统后端 |
| 自定义 Tool | 标准 LangChain tool 即可 |
| 多模态 (v0.5+) | 读图片、PDF、音频 |
| Code Interpreter (v0.6+) | QuickJS WASM 沙箱执行代码 |
