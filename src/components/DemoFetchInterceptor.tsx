'use client'

import { handleMockRequest } from '@/lib/mockHandler'

// Override fetch synchronously at module load time — NOT in useEffect.
// useEffect fires too late (after child components already fetch data).
if (typeof window !== 'undefined') {
  const originalFetch = window.fetch
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
    const method = init?.method?.toUpperCase() || 'GET'

    if (url.includes('demo-api.atlasdenim.fake') || url.includes('railway.app')) {
      let body: unknown
      if (init?.body) {
        try { body = JSON.parse(init.body as string) } catch { body = init.body }
      }
      const data = handleMockRequest(method, url, body)
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    return originalFetch(input, init)
  }
}

export default function DemoFetchInterceptor() {
  return null
}
