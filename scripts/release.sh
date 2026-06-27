#!/bin/bash
set -e

# Yoji 发布脚本
# 用法: ./scripts/release.sh <版本号> "<发布说明>"
# 示例: ./scripts/release.sh 1.1.1 "
# ## 新增
# - 长任务调度
# - 多会话管理
# ## 修复
# - TTS 分句 bug"
#
# 前置条件: `brew install gh && gh auth login`

VERSION="${1:?请提供版本号，如 1.1.1}"
NOTES="${2:?请提供发布说明}"

TAG="v${VERSION}"
DMG="dist/yoji-${VERSION}.dmg"
ZIP="dist/Yoji-${VERSION}-arm64-mac.zip"

echo "==> 检查构建产物..."
[ -f "$DMG" ] || { echo "❌ 未找到 $DMG，请先 pnpm build:mac"; exit 1; }

echo "==> 提交 & 打标签..."
git add .
git commit -m "v${VERSION}" || echo "⚠️  没有新改动"
git tag "$TAG" 2>/dev/null || echo "⚠️  tag $TAG 已存在"
git push origin main --tags

echo "==> 创建 Release & 上传文件..."
gh release create "$TAG" "$DMG" "$ZIP" \
  --title "Yoji v${VERSION}" \
  --notes "$NOTES"

echo "✅ v${VERSION} 发布完成！"
