---
name: yoji-extensions
description: 【以下任一情况必须调用】①用户要播放视频/音频 ②用户要展示图片/截图 ③用户要数据可视化（图表/对比）④用户要预览文档/漫画 ⑤用户要交互工具（倒计时/计算器等）。编写 HTML/JS 并用 preview_html 在应用内窗口展示。
allowed-tools: preview_html, write_file, edit_file, read_file
---

# yoji-extensions — 优姬的外挂工具箱

## 什么时候用

以下场景**写 HTML + preview_html**，不要用文字回复：

| 场景 | 用户说什么 | 做法 |
|---|---|---|
| 🎬 播放视频 | "帮我播这个视频"、"放一下xxx" | HTML `<video>` + preview_html |
| 🖼️ 展示图片 | "展示这几张截图"、"看一下这些图" | HTML `<img>` 画廊 + preview_html |
| 📊 数据可视化 | "画个柱状图"、"对比一下数据" | HTML + Chart.js CDN + preview_html |
| 📄 文档预览 | "预览这个 Markdown"、"看看这个 PDF" | HTML + marked.js + preview_html |
| 🎨 漫画/画册 | "生成漫画预览"、"做个相册" | HTML 分页 + preview_html |
| 🔧 交互工具 | "做个倒计时"、"弄个计算器" | HTML + JS + preview_html |

**不需要 preview_html**：纯文字问答、文件读写、执行命令、网页搜索。

## 工作流程

1. **判断场景**：用户需要可视化展示 → 走本 Skill；文字回复 → 直接答
2. **编写 HTML**：用 `write_file` 在沙箱 `/extensions/` 目录创建 HTML 文件
3. **打开预览**：调用 `preview_html`，`path` 传磁盘绝对路径，`title` 传窗口标题
4. **后续修改**：用户反馈后用 `edit_file` 修改沙箱中的文件，重新 `preview_html`

## 文件存放位置

所有外挂 HTML 工具统一放在沙箱 `/extensions/` 目录，映射到磁盘：
```
/Users/wangxijie/Library/Application Support/yoji/companion/extensions/
```

已有工具清单记录在 `extensions/index.md` 中，每次新增工具后同步更新。

## HTML 编写规范

- `<html><head><body>` 完整结构，CSS 在 `<style>`，JS 在 `<script>`
- 外部库用 CDN（Chart.js、D3.js、marked.js 等）
- 本地视频/图片用绝对路径
- 背景深色，字体舒适，适配窗口
- 播放器场景默认 controls

## 注意事项

- `path` 必须是磁盘绝对路径，**禁止使用沙箱虚拟路径**（如 `/xxx.html`）
- 磁盘绝对路径 = 沙箱路径映射：`/extensions/xxx.html` → `/Users/wangxijie/Library/Application Support/yoji/companion/extensions/xxx.html`
- 用户关闭窗口后重新调 `preview_html` 即可恢复
