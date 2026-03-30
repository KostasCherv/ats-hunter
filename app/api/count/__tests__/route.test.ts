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
  vi.stubEnv('GOOGLE_CSE_API_KEY', 'test-key')
  vi.stubEnv('GOOGLE_CSE_CX', 'test-cx')
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

  it('returns counts for valid queries', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ searchInformation: { totalResults: '142' } }),
    })
    const res = await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.counts['greenhouse.io']).toBe(142)
  })

  it('returns null for a domain when Google fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false })
    const res = await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    const body = await res.json()
    expect(body.counts['greenhouse.io']).toBeNull()
  })

  it('calls Google CSE with correct URL params', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ searchInformation: { totalResults: '10' } }),
    })
    await POST(makeRequest({
      queries: { 'greenhouse.io': 'site:greenhouse.io "AI Engineer"' },
    }))
    const calledUrl = new URL(mockFetch.mock.calls[0][0] as string)
    expect(calledUrl.searchParams.get('key')).toBe('test-key')
    expect(calledUrl.searchParams.get('cx')).toBe('test-cx')
    expect(calledUrl.searchParams.get('num')).toBe('1')
    expect(calledUrl.searchParams.get('q')).toBe('site:greenhouse.io "AI Engineer"')
  })
})
