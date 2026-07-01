import dayjs from 'dayjs'

/**
 * 兼容所有浏览器的复制文本函数
 * @param {string} text 要复制的文字
 * @returns {Promise<boolean>} 是否成功
 */
export const copyText = async (text: string) => {
  try {
    // 优先使用现代浏览器 Clipboard API
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text)
      return true
    }

    // 降级方案：兼容旧浏览器、微信webview、移动端等
    const textArea = document.createElement('textarea')
    textArea.value = text

    // 修复iOS/移动端兼容性
    textArea.style.position = 'fixed'
    textArea.style.left = '-9999px'
    textArea.style.opacity = '0'
    document.body.appendChild(textArea)

    // 选中并复制
    textArea.select()
    // 兼容iOS特殊处理
    textArea.setSelectionRange(0, textArea.value.length)

    const success = document.execCommand('copy')
    document.body.removeChild(textArea)

    return success
  } catch (err) {
    return false
  }
}

//时间展示
export const formatTime = (time?: number | string) => {
  if (!time) return ''
  const d = dayjs(time)
  const now = dayjs()

  if (d.isSame(now, 'day')) return d.format('HH:mm')
  if (d.isSame(now.subtract(1, 'day'), 'day')) return '昨天 ' + d.format('HH:mm')
  if (d.isSame(now, 'year')) return d.format('MM月DD日 HH:mm')
  return d.format('YYYY年MM月DD日 HH:mm')
}

// 文件大小格式化：根据字节数自动展示 B/KB/MB/GB
export const formatFileSize = (bytes?: number | null): string => {
  if (bytes == null || bytes < 0) return ''
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  const idx = Math.min(i, units.length - 1)
  const value = bytes / Math.pow(k, idx)

  return value.toFixed(idx === 0 ? 0 : 1) + ' ' + units[idx]
}
