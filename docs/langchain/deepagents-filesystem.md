# DeepAgents 虚拟文件系统

## 内置工具

| 工具 | 说明 |
|---|---|
| `read_file(path)` | 读取文件 |
| `write_file(path, content)` | 写入文件 |
| `edit_file(path, old, new)` | 编辑文件 |
| `ls(path?)` | 列出目录 |
| `glob(pattern)` | 按模式搜索文件 |
| `grep(pattern)` | 搜索文件内容 |

## 后端选择

| 后端 | 适用场景 |
|---|---|
| `StateBackend` | 内存中，单次会话 |
| `FilesystemBackend` | **落地到真实磁盘**（Electron 用这个） |
| `@langchain/node-vfs` | 内存虚拟文件系统，零外部依赖 |
| Composite Backend | 不同路径路由到不同后端 |

## 数据格式

```ts
{
  content: string,
  encoding: 'utf-8' | 'base64',
  created_at: string,
  modified_at: string,
}
```
