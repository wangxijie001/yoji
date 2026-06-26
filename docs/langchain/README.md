# LangChain 技术文档索引

按主题拆分，需要什么查什么，避免一次性加载太多信息。

| 文件 | 内容 | 什么时候看 |
|---|---|---|
| [deepagents-core.md](deepagents-core.md) | 架构定位、安装、createDeepAgent API、基础调用 | 创建/配置 Agent 时 |
| [deepagents-filesystem.md](deepagents-filesystem.md) | FilesystemBackend / LocalShellBackend、execute 工具、virtualMode | 需要文件读写或执行命令时 |
| [deepagents-subagents.md](deepagents-subagents.md) | 子代理定义、inline/async 模式、上下文隔离 | 拆分复杂任务时 |
| [deepagents-memory.md](deepagents-memory.md) | Memory Store、`memory` 参数、Checkpoint、Backend 关系 | 实现记忆系统时 |
| [deepagents-streaming.md](deepagents-streaming.md) | 流式输出、事件类型、IPC 对接 | 做打字机效果时 |
| [deepagents-middleware.md](deepagents-middleware.md) | interruptOn 工具审批、FilesystemPermission 权限、Skills、MCP | 扩展 Agent 行为时 |
| [deepagents-skills.md](deepagents-skills.md) | Skills 系统完整指南：SKILL.md 格式、渐进式披露、配置、Subagent 集成 | 实现 Skills 时 |
| [deepagents-summarization.md](deepagents-summarization.md) | 摘要中间件、触发策略、与 checkpoint 配合 | 配置摘要时 |
| [project-mapping.md](project-mapping.md) | 框架能力到我们项目的落地映射 | 做架构决策时 |
