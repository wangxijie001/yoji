/**
 * 微信连接 — 接口方法
 */

import { BrowserWindow } from 'electron'
import { get, post } from './request'
import { envConfig, modelConfig } from '../../config'
import { EnvConfig, ModelConfig, WechatTokenData } from '../../../shared/types'
import { chatStream } from '../index'

//是否轮询用户消息
let isPollLoopMessageRunning = false

//token信息
let tokenInfo: WechatTokenData | null = null

// 重试定时器
let retryTimer: ReturnType<typeof setTimeout> | null = null

// 输入状态 ticket
let typingTicket: string | null = null

/** 设置轮询用户消息状态 */
export const changePollLoopMessageRunning = (running: boolean) => {
  isPollLoopMessageRunning = running
  if (running) {
    pollLoopMessage()
  } else {
    if (retryTimer) {
      clearTimeout(retryTimer)
      retryTimer = null
    }
  }
}

/** 设置 token信息 */
export const setTokenInfo = (t: WechatTokenData | null) => {
  tokenInfo = t
}

// ---- Token 持久化 ----

/** 从 envConfig 读取 token */
export function loadToken(): WechatTokenData | null {
  const info = envConfig.get<{ isEnabled: boolean; botToken: string }>('wechatConnectInfo')
  if (!info?.botToken) return null
  try {
    return JSON.parse(info.botToken) as WechatTokenData
  } catch {
    return null
  }
}

/** 保存 token 到 envConfig */
function saveToken(t: WechatTokenData): void {
  const info = envConfig.get<{ isEnabled: boolean; botToken: string }>('wechatConnectInfo')
  envConfig.set('wechatConnectInfo', {
    isEnabled: info?.isEnabled ?? false,
    botToken: JSON.stringify(t)
  })
}

/** 清除 token */
export function clearToken(): void {
  const info = envConfig.get<{ isEnabled: boolean; botToken: string }>('wechatConnectInfo')
  envConfig.set('wechatConnectInfo', {
    isEnabled: info?.isEnabled ?? false,
    botToken: ''
  })
}

// ---- 工具 ----

/** 生成 X-WECHAT-UIN：base64(随机 uint32) */
function randomUin(): string {
  const n = (Math.random() * 0xffffffff) >>> 0
  return Buffer.from(n.toString()).toString('base64')
}

// ---- 发送消息 ----

/** 主动发送文本消息到手机 */
export async function sendMessage(token: WechatTokenData, text: string): Promise<boolean> {
  return sendMsg(token, {
    to_user_id: token.user_id,
    text
  })
}

/** 回复消息（带 context_token 和 client_id） */
export async function sendReply(
  token: WechatTokenData,
  toUser: string,
  text: string,
  contextToken: string,
  clientId: string
): Promise<boolean> {
  return sendMsg(token, {
    to_user_id: toUser,
    text,
    context_token: contextToken,
    client_id: clientId
  })
}

async function sendMsg(
  token: WechatTokenData,
  opts: { to_user_id: string; text: string; context_token?: string; client_id?: string }
): Promise<boolean> {
  const { v4: uuid } = await import('uuid')

  try {
    const res = await post(
      '/ilink/bot/sendmessage',
      {
        msg: {
          from_user_id: '',
          to_user_id: opts.to_user_id,
          client_id: opts.client_id || uuid(),
          message_type: 2,
          message_state: 2,
          context_token: opts.context_token || '',
          item_list: [{ type: 1, text_item: { text: opts.text } }]
        },
        base_info: { channel_version: '1.0.2' }
      },
      10000,
      {
        AuthorizationType: 'ilink_bot_token',
        Authorization: `Bearer ${token.bot_token}`,
        'X-WECHAT-UIN': randomUin()
      }
    )
    return res?.ret === 0
  } catch (err: any) {
    console.error('[wechat] sendmessage 失败:', err.message)
    return false
  }
}
// ---- 输入状态 ----

/** 获取 typing_ticket，有缓存直接返回，没有或失效则重新获取 */
async function ensureTypingTicket(token: WechatTokenData, userId: string): Promise<string | null> {
  if (typingTicket) return typingTicket

  try {
    const res = await post('/ilink/bot/getconfig', { ilink_user_id: userId }, 10000, {
      AuthorizationType: 'ilink_bot_token',
      Authorization: `Bearer ${token.bot_token}`,
      'X-WECHAT-UIN': randomUin()
    })
    typingTicket = res?.typing_ticket || null
    return typingTicket
  } catch (err: any) {
    console.error('[wechat] getconfig 失败:', err.message)
    return null
  }
}

/** 发送"正在输入"状态，status: 1=输入中 2=取消 */
async function sendTyping(
  token: WechatTokenData,
  ticket: string,
  userId: string,
  status: 1 | 2
): Promise<void> {
  try {
    await post(
      '/ilink/bot/sendtyping',
      { ilink_user_id: userId, typing_ticket: ticket, status },
      10000,
      {
        AuthorizationType: 'ilink_bot_token',
        Authorization: `Bearer ${token.bot_token}`,
        'X-WECHAT-UIN': randomUin()
      }
    )
  } catch (err: any) {
    console.error('[wechat] sendtyping 失败:', err.message)
    typingTicket = null // 失效，下次重取
  }
}

// ---- 扫码登录 ----

/** 获取二维码 + 弹窗 + 立即开始轮询 */
async function getQRCodeAndShow(): Promise<void> {
  const res = await get('/ilink/bot/get_bot_qrcode?bot_type=3')
  if (!res?.qrcode) {
    console.error('[wechat] get_bot_qrcode 返回异常:', JSON.stringify(res))
    return
  }

  const win = new BrowserWindow({
    width: 600,
    height: 660,
    title: '微信扫码登录',
    alwaysOnTop: true,
    resizable: false
  })
  win.loadURL(res.qrcode_img_content || '')

  pollQRCodeStatus(win, res.qrcode)
}

/** 轮询扫码状态，确认后存 token + 启动消息轮询 */
async function pollQRCodeStatus(win: BrowserWindow, qrcode: string): Promise<void> {
  const MAX_TIME = 240 // 4 分钟总超时

  let elapsed = 0
  let pending = false
  let timer: ReturnType<typeof setInterval> | null = null

  return new Promise((resolve) => {
    const onClose = (): void => {
      if (timer) clearInterval(timer)
      resolve()
    }
    win.on('closed', onClose)

    timer = setInterval(async () => {
      if (win.isDestroyed()) {
        if (timer) clearInterval(timer)
        resolve()
        return
      }

      elapsed += 2
      if (elapsed > MAX_TIME) {
        if (timer) clearInterval(timer)
        win.removeListener('closed', onClose)
        win.close()
        resolve()
        return
      }

      if (pending) return
      pending = true

      try {
        const sr = await get(`/ilink/bot/get_qrcode_status?qrcode=${encodeURIComponent(qrcode)}`)

        if (sr.status === 'confirmed') {
          if (timer) clearInterval(timer)
          win.removeListener('closed', onClose)
          win.close()
          const token: WechatTokenData = {
            bot_token: sr.bot_token,
            ilink_bot_id: sr.ilink_bot_id,
            baseurl: sr.baseurl || 'https://ilinkai.weixin.qq.com',
            user_id: sr.ilink_user_id || sr.user_id
          }
          saveToken(token)
          setTokenInfo(token)
          changePollLoopMessageRunning(true)
          resolve()
          return
        }

        if (sr.status === 'expired') {
          // 过期 → 重新获取二维码（内部递归轮询）
          win.removeListener('closed', onClose)
          win.close()
          getQRCodeAndShow()
          if (timer) clearInterval(timer)
          resolve()
          return
        }
      } catch (err: any) {
        if (err.message !== 'timeout') {
          console.error('[wechat] get_qrcode_status 异常:', err.message)
        }
      } finally {
        pending = false
      }
    }, 2000)
  })
}

// ---- AI 回复 ----

async function getAIReply(messages: { role: 'user'; content: string }[]): Promise<string> {
  const { activeProvider, isDeepThinkEnabled } = envConfig.getAll() as EnvConfig
  const stored = modelConfig.get(activeProvider) as ModelConfig | undefined
  if (!stored) return '请先在设置中配置模型'
  if (!stored.apiKey) return '请先在设置中配置 API Key'
  const config = {
    apiKey: stored.apiKey,
    provider: activeProvider,
    model: stored.model,
    baseURL: stored.baseURL || (stored as any).baseUrl || '',
    modelKwargs: { thinking: { type: isDeepThinkEnabled ? 'enabled' : 'disabled' } }
  } as ModelConfig

  return new Promise((resolve) => {
    let reply = ''
    chatStream(config as any, messages, {
      onChunk: (data: any) => {
        if (data.type === 'result') reply += data.content
      },
      onDone: () => resolve(reply),
      onError: (errMsg: string) => {
        console.error('[wechat] AI 回复失败:', errMsg)
        resolve(reply || `出错了: ${errMsg}`)
      }
    })
  })
}

// ---- 消息轮询 ----

/**
 * 长轮询收消息
 * 由 isPollLoopMessageRunning 控制启停，tokenInfo 提供凭证
 */
export async function pollLoopMessage(): Promise<void> {
  if (!isPollLoopMessageRunning) return

  if (!tokenInfo) {
    getQRCodeAndShow() // 无 token → 走扫码流程，链式到 pollQRCodeStatus → pollLoopMessage
    return
  }

  let cursor = ''
  console.log('[wechat] 消息轮询开始')

  while (isPollLoopMessageRunning) {
    try {
      const res = await post(
        '/ilink/bot/getupdates',
        {
          get_updates_buf: cursor,
          base_info: { channel_version: '1.0.2' }
        },
        35000,
        {
          AuthorizationType: 'ilink_bot_token',
          Authorization: `Bearer ${tokenInfo.bot_token}`,
          'X-WECHAT-UIN': randomUin()
        }
      )

      // token 过期 → 清理 + 重新扫码
      if (res.ret === -14 || res.ret === -2) {
        console.log('[wechat] token 过期，需重新扫码')
        clearToken()
        setTokenInfo(null)
        isPollLoopMessageRunning = false
        envConfig.set('wechatConnectInfo', { isEnabled: false, botToken: '' })
        getQRCodeAndShow()
        return
      }

      // 更新游标
      if (res.get_updates_buf) {
        cursor = res.get_updates_buf
      }

      // 收集文本消息
      const messages: { role: 'user'; content: string }[] = []
      let lastMsg: any = null

      for (const msg of res.msgs || []) {
        const item = msg.item_list?.find((i: any) => i.type === 1)
        const text = item?.text_item?.text
        if (!text) continue
        messages.push({ role: 'user', content: text + '\n\n ——来自手机微信'  })
        lastMsg = msg
      }

      if (messages.length === 0) continue

      const ticket = await ensureTypingTicket(tokenInfo, lastMsg.from_user_id)

      if (ticket) {
        await sendTyping(tokenInfo, ticket, lastMsg.from_user_id, 1)
      }

      // 接入 AI Agent 生成回复
      const reply = await getAIReply(messages)

      await sendReply(
        tokenInfo,
        lastMsg.from_user_id,
        reply,
        lastMsg.context_token,
        lastMsg.client_id
      )

      if (ticket) {
        await sendTyping(tokenInfo, ticket, lastMsg.from_user_id, 2)
      }
    } catch (err: any) {
      if (err.message === 'timeout') continue // 长轮询超时正常
      console.error('[wechat] getupdates 异常:', err.message)
      await new Promise<void>((r) => {
        retryTimer = setTimeout(() => {
          retryTimer = null
          r()
        }, 3000)
      })
    }
  }

  if (retryTimer) {
    clearTimeout(retryTimer)
    retryTimer = null
  }
  console.log('[wechat] 已断开，停止轮询')
}
