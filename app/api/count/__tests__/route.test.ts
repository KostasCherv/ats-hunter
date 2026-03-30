import { describe, it, expect, vi, beforeEach } from 'vitest'
import { POST } from '../route'
import { NextRequest } from 'next/server'

function makeRequest(body: unknown) {
  return new NextRequest('http://localhost/api/count', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

const mockFetch = vi.fn()

beforeEach(() => {
  vi.stubGlobal('fetch', mockFetch)
  vi.stubEnv('BRAVE_SEARCH_API_KEY', 'test-key')
  mockFetch.mockReset()
})

describe('POST /api/count', () => {
  it('returns 400 for invalid input', async () => {
    const res = await POST(makeRequest({ queries: 'not-an-object' }))
    expect(res.status).toBe(400)
  })

  it('returns 400 when more than 15 domains submitted', async () => {
    const queries = Object.fromEntries(
      Array.from({ length: 16 }, (_, i) => [`domain${i}.com`, `query ${i}`])
    )
    const res = await POST(makeRequest({ queries }))
    expect(res.status).toBe(400)
  })

  it('returns exact count when results < 20 and no more available', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: Array(5).fill({}) }, query: { more_results_available: false } }),
    })
    const res = await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts['greenhouse.io']).toBe(5)
  })

  it('returns -1 when more results are available', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: Array(20).fill({}) }, query: { more_results_available: true } }),
    })
    const res = await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    const body = await res.json()
    expect(body.counts['greenhouse.io']).toBe(-1)
  })

  it('returns null for a domain when fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const res = await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    const body = await res.json()
    expect(body.counts['greenhouse.io']).toBeNull()
  })

  it('calls Brave Search with correct params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ web: { results: Array(10).fill({}) }, query: { more_results_available: false } }),
    })
    await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string)
    const calledOptions = mockFetch.mock.calls[0][1] as RequestInit
    expect(calledUrl.hostname).toBe('api.search.brave.com')
    expect(calledUrl.searchParams.get('q')).toBe('site:greenhouse.io "AI Engineer"')
    expect(calledUrl.searchParams.get('count')).toBe('20')
    expect((calledOptions.headers as Record<string, string>)['X-Subscription-Token']).toBe('test-key')
  })
})
