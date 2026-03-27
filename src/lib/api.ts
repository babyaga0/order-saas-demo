// ============================================================
// ATLAS DENIM — Mock API (no real backend)
// Drop-in replacement for the axios api instance.
// ============================================================

import { handleMockRequest } from './mockHandler'
import type { ApiResponse } from '@/types'

function mockResponse(method: string, url: string, data?: unknown) {
  return Promise.resolve({
    data: handleMockRequest(method, url, data),
    status: 200,
    statusText: 'OK',
    headers: {},
    config: {} as any,
  })
}

// Drop-in replacement for the axios instance
const api = {
  get:    (url: string, config?: unknown)              => mockResponse('GET',    url),
  post:   (url: string, data?: unknown, config?: unknown) => mockResponse('POST',   url, data),
  put:    (url: string, data?: unknown, config?: unknown) => mockResponse('PUT',    url, data),
  delete: (url: string, config?: unknown)              => mockResponse('DELETE', url),
  patch:  (url: string, data?: unknown, config?: unknown) => mockResponse('PATCH',  url, data),
  interceptors: {
    request:  { use: () => {} },
    response: { use: () => {} },
  },
  defaults: { headers: { common: {} } },
} as any

export async function apiCall<T>(
  method: 'get' | 'post' | 'put' | 'delete',
  url: string,
  data?: unknown
): Promise<ApiResponse<T>> {
  const response = await mockResponse(method.toUpperCase(), url, data)
  return { data: response.data as T }
}

export default api
