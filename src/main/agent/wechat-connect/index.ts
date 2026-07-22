import { envConfig } from "../../config";
import { changePollLoopMessageRunning, setTokenInfo, loadToken } from './wechat-server'

export async function toggleWechat(): Promise<boolean> {
   const info = envConfig.get<{ isEnabled: boolean; botToken: string }>('wechatConnectInfo')
   const { isEnabled } = info || {}

   if (isEnabled) {
    // 断开
    envConfig.set('wechatConnectInfo', { ...info, isEnabled: false })
    changePollLoopMessageRunning(false)
    return false
   }

   // 连接
   envConfig.set('wechatConnectInfo', { ...info, isEnabled: true })
   setTokenInfo(loadToken())
   changePollLoopMessageRunning(true)
   return true
}

// 初始化微信连接
export async function initWechatConnect() {
    const info = envConfig.get<{ isEnabled: boolean; botToken: string }>('wechatConnectInfo')
    setTokenInfo(loadToken())
    changePollLoopMessageRunning(info?.isEnabled || false)
}