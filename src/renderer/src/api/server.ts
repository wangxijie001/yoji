/**
 * 渲染进程 HTTP 请求封装
 *
 * 与 axios 调用风格一致，泛型支持完整。内部通过 IPC 交由主进程执行。
 */

// 可序列化的请求配置（函数类字段过 IPC 会丢失，暂不支持）
interface RequestConfig {
  headers?: Record<string, string>
  params?: Record<string, unknown>
  timeout?: number
  signal?: AbortSignal
  // 可继续扩展其他可序列化字段
}

interface ApiResponse<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}

async function request<T>(method: string, url: string, data?: unknown, config?: RequestConfig): Promise<T> {
  const res = await window.api.request({
    method: method as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE',
    url,
    data,
    params: config?.params,
  }) as ApiResponse<T>
  if (!res.ok) {
    throw new Error(res.error || '请求失败')
  }
  return res.data as T
}

const api = {
  get<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return  request<T>('GET', url, undefined, config)
  },

  post<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<T> {
    return request<T>('POST', url, data, config)
  },

  put<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<T> {
    return request<T>('PUT', url, data, config)
  },

  patch<T = unknown, D = unknown>(url: string, data?: D, config?: RequestConfig): Promise<T> {
    return request<T>('PATCH', url, data, config)
  },

  delete<T = unknown>(url: string, config?: RequestConfig): Promise<T> {
    return request<T>('DELETE', url, undefined, config)
  },
}

export default api
