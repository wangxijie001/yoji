import axios, { type AxiosInstance, type AxiosRequestConfig } from 'axios'
import type { AxiosError } from 'axios'

// 创建实例，全局配置
const http: AxiosInstance = axios.create({
  baseURL: 'https://your-api.com', // TODO: 换成你的 API 地址
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
})

// ========== 请求拦截器 ==========
http.interceptors.request.use(
  (config) => {
    // TODO: 添加 token 等
    return config
  },
  (error) => Promise.reject(error),
)

// ========== 响应拦截器 ==========
http.interceptors.response.use(
  (response) => response,
  (error: AxiosError<{ message?: string }>) => {
    if (error.response) {
      const { status, data } = error.response

      switch (status) {
        case 401:
          console.error('未登录或 Token 过期')
          break
        case 403:
          console.error('无权限访问')
          break
        case 404:
          console.error('请求的资源不存在')
          break
        case 500:
          console.error('服务器错误')
          break
        default:
          console.error(`请求失败: ${status}`)
      }

      return Promise.reject(new Error(data?.message || `请求失败 (${status})`))
    }

    if (error.code === 'ECONNABORTED') {
      return Promise.reject(new Error('请求超时'))
    }

    if (!error.response) {
      return Promise.reject(new Error('网络错误，请检查网络连接'))
    }

    return Promise.reject(error)
  },
)

// ========== 通用请求封装 ==========
type RequestConfig<D = unknown> = AxiosRequestConfig<D>

const request = {
  get<T = unknown>(url: string, config?: RequestConfig) {
    return http.get<unknown, T>(url, config)
  },

  post<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>) {
    return http.post<unknown, T, D>(url, data, config)
  },

  put<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>) {
    return http.put<unknown, T, D>(url, data, config)
  },

  patch<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig<D>) {
    return http.patch<unknown, T, D>(url, data, config)
  },

  delete<T = unknown>(url: string, config?: RequestConfig) {
    return http.delete<unknown, T>(url, config)
  },

  // 需要完整 axios 能力时直接使用原始实例
  instance: http,
}

export default request
