/**
 * 微信连接 — HTTP 请求工具
 */

import https from 'https'

export const BASE_URL = 'https://ilinkai.weixin.qq.com'

export function request(
  method: 'GET' | 'POST',
  path: string,
  opts?: { body?: unknown; timeout?: number; headers?: Record<string, string> }
): Promise<any> {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL)
    const bodyStr = opts?.body ? JSON.stringify(opts.body) : ''

    const headers: Record<string, string> = {
      'iLink-App-ClientVersion': '1',
      ...opts?.headers
    }

    if (method === 'POST') {
      headers['Content-Type'] = 'application/json'
      headers['Content-Length'] = Buffer.byteLength(bodyStr).toString()
    }

    const req = https.request(
      {
        hostname: url.hostname,
        path: url.pathname + url.search,
        method,
        timeout: opts?.timeout ?? 10000,
        headers
      },
      (res) => {
        let d = ''
        res.on('data', (c) => (d += c))
        res.on('end', () => {
          try {
            resolve(JSON.parse(d))
          } catch {
            resolve(d)
          }
        })
      }
    )

    req.on('timeout', () => {
      req.destroy()
      reject(new Error('timeout'))
    })
    req.on('error', reject)

    if (method === 'POST') {
      req.write(bodyStr)
    }
    req.end()
  })
}

export function get(path: string, timeout?: number): Promise<any> {
  return request('GET', path, { timeout })
}

export function post(path: string, body?: unknown, timeout?: number, headers?: Record<string, string>): Promise<any> {
  return request('POST', path, { body, timeout, headers })
}
