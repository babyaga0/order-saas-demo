'use client'

import { useEffect } from 'react'
import { handleMockRequest } from '@/lib/mockHandler'

// Override window.fetch to intercept all calls to the demo API URL
// This covers pages that use fetch() directly instead of the api.ts module.
export default function DemoFetchInterceptor() {
  useEffect(() => {
    const originalFetch = window.fetch

    window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : (input as Request).url
      const method = init?.method?.toUpperCase() || 'GET'

      // Intercept calls to the demo fake API hostname
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

    return () => {
      window.fetch = originalFetch
    }
  }, [])

  return null
}
