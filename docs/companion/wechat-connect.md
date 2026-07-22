# 微信连接（iLink Bot）

## 概述

通过微信 ClawBot（iLink 协议）将 Yoji 连接到微信个人号，用户可通过手机微信与 AI 助手对话。

**核心限制**：微信 iLink Bot **只能回复、不能主动发消息**。`sendmessage` 接口要求 `context_token`（从入站消息获取），没有入站消息就没有 `context_token`。因此需要用户先在微信发一条消息，bot 才能回复。

## 文件结构

```
src/main/agent/wechat-connect/
├── index.ts            # 对外入口：toggleWechat / initWechatConnect
├── request.ts          # HTTP 工具：get / post，统一 BASE_URL + 公共请求头
├── wechat-server.ts    # 核心逻辑：扫码登录、消息轮询、发送/回复、输入状态、AI 回复
└── server.ts           # 旧版（保留参考，后续移除）
```

## 架构

```
渲染进程                        主进程                             微信服务器
─────────                      ────────                           ────────
toggleWechat() ──IPC──→  toggleWechat()
                            ├─ isEnabled=true
                            ├─ setTokenInfo(loadToken())
                            └─ changePollLoopMessageRunning(true)
                                  └─ pollLoopMessage()
                                       └─ POST getupdates ──────────→
                                       ←── msgs[] ──────────────────
                                       ├─ ensureTypingTicket
                                       ├─ sendTyping(1) ────────────→
                                       ├─ getAIReply(messages)
                                       ├─ sendReply() ──────────────→
                                       └─ sendTyping(2) ────────────→
```

## 登录流程

```
getQRCodeAndShow()
  ├─ GET /ilink/bot/get_bot_qrcode?bot_type=3
  ├─ 返回 { qrcode, qrcode_img_content }
  ├─ BrowserWindow 加载 qrcode_img_content（微信扫码页面）
  └─ pollQRCodeStatus(win, qrcode)
       ├─ setInterval 2s 轮询 GET /ilink/bot/get_qrcode_status?qrcode=xxx
       │   ├─ status=wait/scaned → 继续轮询
       │   ├─ status=expired → 关窗 → 递归 getQRCodeAndShow()
       │   └─ status=confirmed → 存 token → 启动消息轮询
       ├─ 用户关窗 → 结束
       └─ 4分钟超时 → 结束
```

扫码确认后自动：
1. `saveToken()` — 持久化到 envConfig
2. `setTokenInfo()` — 写入模块级变量
3. `changePollLoopMessageRunning(true)` — 启动消息轮询

## 消息轮询

```
pollLoopMessage()
  ├─ !isPollLoopMessageRunning → 立刻退出
  ├─ !tokenInfo → getQRCodeAndShow() 走扫码
  └─ while(isPollLoopMessageRunning)
       ├─ POST /ilink/bot/getupdates (35s 长轮询)
       │   ├─ ret=-14/-2 → 清 token + 重新扫码
       │   ├─ 超时 → continue（正常，无新消息）
       │   └─ 有新消息 → 收集为 [{role:'user', content:'...'}]
       ├─ ensureTypingTicket（缓存，只调一次 getconfig）
       ├─ sendTyping(1) "正在输入..."
       ├─ getAIReply(messages) → chatStream → Agent 生成回复
       ├─ sendReply(toUser, text, context_token, client_id)
       └─ sendTyping(2) 取消
```

## 启停控制

通过模块级变量控制，不再反复读 envConfig：

| 变量 | 作用 |
|------|------|
| `isPollLoopMessageRunning` | `while` 循环条件，false 时退出 |
| `tokenInfo` | 当前 token 凭证，null 时自动触发扫码 |
| `retryTimer` | 错误重试的 `setTimeout` 引用，断开时 `clearTimeout` |
| `typingTicket` | typing ticket 缓存，失效自动重取 |

## IPC 通道

按项目现有模式挂在 `agent` 模块下：

| Channel | 方法 | 说明 |
|---------|------|------|
| `wechat:toggle` | `ipcMain.handle` | 切换微信连接状态，返回 `{ ok, data: { connected } }` |

**Preload API**: `window.api.agent.toggleWechat()`  
**渲染进程**: `agent.toggleWechat()`（在 `src/renderer/src/api/agent.ts`）

## Token 持久化

- 存储位置：`envConfig.wechatConnectInfo`
- 格式：`{ isEnabled: boolean, botToken: string }`（`botToken` 为 `WechatTokenData` 的 JSON 序列化）
- `loadToken()` — 读取 + JSON.parse
- `saveToken()` — JSON.stringify + 写入
- `clearToken()` — 清空 botToken（保留 isEnabled 不变）

## API 接口速查

Base URL: `https://ilinkai.weixin.qq.com`  
公共 Header: `iLink-App-ClientVersion: 1`, `X-WECHAT-UIN: base64(随机uint32)`

| 端点 | 方法 | 说明 | 鉴权 |
|------|------|------|------|
| `/ilink/bot/get_bot_qrcode?bot_type=3` | GET | 获取登录二维码 | 否 |
| `/ilink/bot/get_qrcode_status?qrcode=xxx` | GET | 长轮询扫码状态 | 否 |
| `/ilink/bot/getupdates` | POST | 长轮询收消息(35s) | Bearer |
| `/ilink/bot/sendmessage` | POST | 发送/回复消息 | Bearer |
| `/ilink/bot/getconfig` | POST | 获取 typing_ticket | Bearer |
| `/ilink/bot/sendtyping` | POST | 发送输入状态 | Bearer |

### sendmessage 请求体（回复模式）

```json
{
  "msg": {
    "from_user_id": "",
    "to_user_id": "xxx@im.wechat",
    "client_id": "uuid",
    "message_type": 2,
    "message_state": 2,
    "context_token": "从入站消息回传",
    "item_list": [{ "type": 1, "text_item": { "text": "回复内容" } }]
  },
  "base_info": { "channel_version": "1.0.2" }
}
```

### 消息 item type 对照

| type | 类型 |
|------|------|
| 1 | 文本 |
| 2 | 图片 |
| 3 | 语音 |
| 4 | 文件 |
| 5 | 视频 |

## 参考文档

- [微信 ClawBot 协议分析](https://mp.weixin.qq.com/s?__biz=MzkzNzg1NjUzNg==&mid=2247484212&idx=1&sn=8f3824163326bcbf30cdb521df6dbe28)
- [微信 iLink Bot API 通信协议规范](https://mp.weixin.qq.com/s?__biz=MzI3NjQyOTQ2Mg==&mid=2247494174&idx=1&sn=c919c20b585017798d1032aaf811cf66)
- [官方 ClawBot 接口文档](https://developers.weixin.qq.com/doc/aispeech/knowledge/openapi/Clawbotrelated.html)
