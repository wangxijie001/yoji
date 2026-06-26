# DeepAgents 虚拟文件系统

## 内置工具

| 工具 | 说明 | 来源 |
|------|------|------|
| `read_file(path)` | 读取文件 | FilesystemBackend |
| `write_file(path, content)` | 写入文件 | FilesystemBackend |
| `edit_file(path, old, new)` | 编辑文件 | FilesystemBackend |
| `ls(path?)` | 列出目录 | FilesystemBackend |
| `glob(pattern)` | 按模式搜索文件 | FilesystemBackend |
| `grep(pattern)` | 搜索文件内容 | FilesystemBackend |
| `execute(command)` | **执行系统 Shell 命令** | **LocalShellBackend 专属** |

## 后端选择

| 后端 | 适用场景 | execute | 安全性 |
|------|----------|:---:|------|
| `StateBackend` | 内存中，单次会话 | ❌ | 最高 |
| `FilesystemBackend` | **落地到真实磁盘**（我们用的） | ❌ | 高（virtualMode 锁在 rootDir） |
| **`LocalShellBackend`** | 需要执行 Shell 命令 | ✅ | 文件操作锁在 rootDir，但 execute 可访问全系统 |
| Composite Backend | 不同路径路由到不同后端 | 取决于组合 | 视组合而定 |

## FilesystemBackend

```ts
import { FilesystemBackend } from 'deepagents'

new FilesystemBackend({
  rootDir: COMPANION_DIR,   // 根目录
  virtualMode: true,        // true = 锁在 rootDir 内，无法越界
  maxFileSizeMb: 10,        // 单文件最大 MB
})
```

**`virtualMode: true` 的效果**：所有文件操作（read/write/edit/ls/glob/grep）被限制在 `rootDir` 内，路径穿越攻击无效。这是我们当前使用的模式。

## LocalShellBackend（继承 FilesystemBackend）

`LocalShellBackend extends FilesystemBackend`，拥有全部文件操作能力，**额外增加 `execute` 工具**。

```ts
import { LocalShellBackend } from 'deepagents'

new LocalShellBackend({
  rootDir: COMPANION_DIR,    // 文件操作 + execute cwd 都在此目录
  virtualMode: true,         // 文件操作仍然锁在 rootDir
  timeout: 30,               // 命令超时秒数（默认 120）
  maxOutputBytes: 100000,    // 输出最大字节（默认 100000）
  inheritEnv: true,          // 继承系统环境变量（PATH 等，推荐开启）
  env: {},                   // 额外自定义环境变量
})
```

### 关键区别

| 能力 | FilesystemBackend | LocalShellBackend |
|------|:---:|:---:|
| 文件读写 | ✅（virtualMode 限制） | ✅（virtualMode 限制） |
| `execute` Shell 命令 | ❌ | ✅（**不受 virtualMode 限制**） |

> ⚠️ `execute` 命令的 `cwd` 在 `rootDir`，但命令本身可以访问整个系统。Agent 拿到的是用户账号的全权限 Shell。建议配合 [`interruptOn`](deepagents-middleware.md) 对 `execute` 加审批。

## 数据格式

```ts
{
  content: string,
  encoding: 'utf-8' | 'base64',
  created_at: string,
  modified_at: string,
}
```
