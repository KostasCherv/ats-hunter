# Live Result Counts Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Display estimated Google result counts per ATS platform in real-time as the user changes search criteria.

**Architecture:** A debounced client hook (`usePlatformCounts`) calls a server-side `/api/count` route 500ms after the user stops typing. The route fans out parallel requests to the Google Custom Search API (one per selected platform) and returns a `Record<domain, number | null>` map. Count badges render next to each platform chip.

**Tech Stack:** Next.js 16 API Routes, Google Custom Search API, Zod (input validation), Vitest + Testing Library (tests), CSS Modules (existing styling system)

---

## Setup

You'll need two Google credentials before starting:

1. **API key** — [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials → Create API Key → restrict to "Custom Search API"
2. **Search Engine ID (cx)** — [programmablesearchengine.google.com](https://programmablesearchengine.google.com) → New search engine → "Search the entire web" → copy the ID

Add to `.env.local`:
```
GOOGLE_CSE_API_KEY=your_api_key_here
GOOGLE_CSE_CX=your_cx_id_here
```

---

## Task 1: Drop Static Export + Add Test Infrastructure

**Files:**
- Modify: `next.config.js`
- Create: `vitest.config.ts`
- Create: `vitest.setup.ts`
- Modify: `package.json`

**Step 1: Remove `output: 'export'` from next.config.js**

```js
/** @type {import('next').NextConfig} */
const nextConfig = {}

module.exports = nextConfig
```

**Step 2: Install test dependencies**

```bash
npm install -D vitest @vitejs/plugin-react jsdom @testing-library/react @testing-library/user-event
```

**Step 3: Create `vitest.config.ts`**

```ts
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
  },
})
```

**Step 4: Create `vitest.setup.ts`**

```ts
import '@testing-library/react'
```

**Step 5: Add test script to `package.json`**

In the `"scripts"` section, add:
```json
"test": "vitest run",
"test:watch": "vitest"
```

**Step 6: Verify build still passes**

```bash
npm run build
```
Expected: exits 0, no errors.

**Step 7: Commit**

```bash
git add next.config.js vitest.config.ts vitest.setup.ts package.json package-lock.json
git commit -m "chore: drop static export, add vitest infrastructure"
```

---

## Task 2: `useDebounce` Hook

**Files:**
- Create: `app/hooks/useDebounce.ts`
- Create: `app/hooks/__tests__/useDebounce.test.ts`

**Step 1: Create the test file**

```ts
// app/hooks/__tests__/useDebounce.test.ts
import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { useDebounce } from '../useDebounce'

describe('useDebounce', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('returns the initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 500))
    expect(result.current).toBe('hello')
  })

  it('does not update before the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'hello' } }
    )
    rerender({ value: 'world' })
    act(() => vi.advanceTimersByTime(300))
    expect(result.current).toBe('hello')
  })

  it('updates after the delay', () => {
    const { result, rerender } = renderHook(
      ({ value }) => useDebounce(value, 500),
      { initialProps: { value: 'hello' } }
    )
    rerender({ value: 'world' })
    act(() => vi.advanceTimersByTime(500))
    expect(result.current).toBe('world')
  })
})
```

**Step 2: Run tests — expect FAIL**

```bash
npm test
```
Expected: FAIL — `Cannot find module '../useDebounce'`

**Step 3: Create the hook**

```ts
// app/hooks/useDebounce.ts
import { useState, useEffect } from 'react'

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value)

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])

  return debounced
}
```

**Step 4: Run tests — expect PASS**

```bash
npm test
```
Expected: 3 tests pass.

**Step 5: Commit**

```bash
git add app/hooks/useDebounce.ts app/hooks/__tests__/useDebounce.test.ts
git commit -m "feat: add useDebounce hook"
```

---

## Task 3: `/api/count` Route

**Files:**
- Create: `app/api/count/route.ts`
- Create: `app/api/count/__tests__/route.test.ts`

**Step 1: Install Zod**

```bash
npm install zod
```

**Step 2: Write the failing test**

```ts
// app/api/count/__tests__/route.test.ts
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
    const calledUrl = mockFetch.mock.calls[0][0] as string
    expect(calledUrl).toContain('key=test-key')
    expect(calledUrl).toContain('cx=test-cx')
    expect(calledUrl).toContain('num=1')
    expect(calledUrl).toContain(encodeURIComponent('site:greenhouse.io "AI Engineer"'))
  })
})
```

**Step 3: Run tests — expect FAIL**

```bash
npm test
```
Expected: FAIL — `Cannot find module '../route'`

**Step 4: Create the route**

```ts
// app/api/count/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const schema = z.object({
  queries: z
    .record(z.string(), z.string())
    .refine((q) => Object.keys(q).length <= 15, {
      message: 'Maximum 15 domains per request',
    }),
})

export async function POST(req: NextRequest) {
  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const parsed = schema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 })
  }

  const { queries } = parsed.data
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX

  if (!apiKey || !cx) {
    return NextResponse.json({ error: 'CSE not configured' }, { status: 500 })
  }

  const entries = Object.entries(queries)
  const results = await Promise.all(
    entries.map(async ([domain, query]) => {
      try {
        const url = new URL('https://www.googleapis.com/customsearch/v1')
        url.searchParams.set('key', apiKey)
        url.searchParams.set('cx', cx)
        url.searchParams.set('q', query)
        url.searchParams.set('num', '1')
        const res = await fetch(url.toString())
        if (!res.ok) return [domain, null] as const
        const data = await res.json()
        const count = parseInt(data.searchInformation?.totalResults ?? '0', 10)
        return [domain, isNaN(count) ? null : count] as const
      } catch {
        return [domain, null] as const
      }
    })
  )

  return NextResponse.json({ counts: Object.fromEntries(results) })
}
```

**Step 5: Run tests — expect PASS**

```bash
npm test
```
Expected: all 5 route tests + 3 debounce tests pass.

**Step 6: Commit**

```bash
git add app/api/count/route.ts app/api/count/__tests__/route.test.ts package.json package-lock.json
git commit -m "feat: add /api/count route with Google CSE integration"
```

---

## Task 4: `usePlatformCounts` Hook

**Files:**
- Create: `app/hooks/usePlatformCounts.ts`
- Create: `app/hooks/__tests__/usePlatformCounts.test.ts`

**Step 1: Write the failing test**

```ts
// app/hooks/__tests__/usePlatformCounts.test.ts
import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePlatformCounts } from '../usePlatformCounts'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
})

afterEach(() => vi.useRealTimers())

describe('usePlatformCounts', () => {
  it('starts with empty counts and not loading', () => {
    const { result } = renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, true)
    )
    expect(result.current.counts).toEqual({})
    expect(result.current.loading).toBe(false)
  })

  it('does not fetch when disabled', async () => {
    renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, false)
    )
    act(() => vi.advanceTimersByTime(600))
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches after debounce delay and updates counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ counts: { 'greenhouse.io': 142 } }),
    })
    const { result } = renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, true)
    )
    act(() => vi.advanceTimersByTime(500))
    await waitFor(() => expect(result.current.counts['greenhouse.io']).toBe(142))
    expect(result.current.loading).toBe(false)
  })
})
```

**Step 2: Run tests — expect FAIL**

```bash
npm test
```
Expected: FAIL — `Cannot find module '../usePlatformCounts'`

**Step 3: Create the hook**

```ts
// app/hooks/usePlatformCounts.ts
import { useState, useEffect } from 'react'
import { useDebounce } from './useDebounce'

type Counts = Record<string, number | null>

export function usePlatformCounts(
  queries: Record<string, string>,
  enabled: boolean
) {
  const [counts, setCounts] = useState<Counts>({})
  const [loading, setLoading] = useState(false)
  const debouncedQueries = useDebounce(queries, 500)

  useEffect(() => {
    if (!enabled || Object.keys(debouncedQueries).length === 0) return

    let cancelled = false
    setLoading(true)

    fetch('/api/count', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ queries: debouncedQueries }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setCounts(data.counts ?? {})
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [debouncedQueries, enabled])

  return { counts, loading }
}
```

**Step 4: Run all tests — expect PASS**

```bash
npm test
```
Expected: 11 tests pass.

**Step 5: Commit**

```bash
git add app/hooks/usePlatformCounts.ts app/hooks/__tests__/usePlatformCounts.test.ts
git commit -m "feat: add usePlatformCounts hook"
```

---

## Task 5: Wire Counts into `page.tsx`

**Files:**
- Modify: `app/page.tsx`
- Modify: `app/page.module.css`

**Step 1: Add the queries memo and hook call**

In `page.tsx`, add these imports at the top:
```ts
import { useMemo } from 'react'
import { usePlatformCounts } from './hooks/usePlatformCounts'
```

Inside the `Home` component, after existing state declarations, add:

```ts
const queries = useMemo(() => {
  return Object.fromEntries(
    [...selected].map((domain) => [domain, buildQuery(domain)])
  )
}, [selected, titles, location, workType, keywords])

const { counts, loading } = usePlatformCounts(queries, hasConfig)
```

**Step 2: Update the ATS platform chip render**

Find this block in the `atsGrid` map:
```tsx
<button
  key={a.domain}
  className={`${styles.atsItem} ${selected.has(a.domain) ? styles.atsSelected : ''}`}
  onClick={() => toggleAts(a.domain)}
>
  <span className={styles.atsDot} />
  <span>{a.label}</span>
</button>
```

Replace with:
```tsx
<button
  key={a.domain}
  className={`${styles.atsItem} ${selected.has(a.domain) ? styles.atsSelected : ''}`}
  onClick={() => toggleAts(a.domain)}
>
  <span className={styles.atsDot} />
  <span>{a.label}</span>
  {selected.has(a.domain) && (
    <span className={styles.atsCount}>
      {loading
        ? '…'
        : counts[a.domain] != null
          ? counts[a.domain]!.toLocaleString()
          : '—'}
    </span>
  )}
</button>
```

**Step 3: Add "Open All" button**

Find the `miniActions` div:
```tsx
<div className={styles.miniActions}>
  <button className={styles.textBtn} onClick={() => setSelected(new Set(ATS_PLATFORMS.map(a => a.domain)))}>All</button>
  <button className={styles.textBtn} onClick={() => setSelected(new Set())}>None</button>
</div>
```

Replace with:
```tsx
<div className={styles.miniActions}>
  <button className={styles.textBtn} onClick={() => setSelected(new Set(ATS_PLATFORMS.map(a => a.domain)))}>All</button>
  <button className={styles.textBtn} onClick={() => setSelected(new Set())}>None</button>
  {hasConfig && (
    <button
      className={styles.textBtn}
      onClick={() => {
        [...selected].forEach((domain) => openSearch(buildQuery(domain)))
      }}
    >
      Open all ↗
    </button>
  )}
</div>
```

**Step 4: Add CSS for count badge**

Add to `page.module.css`:
```css
.atsCount {
  margin-left: auto;
  font-size: 11px;
  font-family: var(--font-mono, 'DM Mono', monospace);
  color: var(--text-muted);
  letter-spacing: 0.02em;
}
```

**Step 5: Verify the build passes**

```bash
npm run build
```
Expected: exits 0.

**Step 6: Commit**

```bash
git add app/page.tsx app/page.module.css
git commit -m "feat: show live result counts and open-all button on ATS chips"
```

---

## Task 6: Environment Variable Documentation + Deploy

**Files:**
- Create: `.env.local.example`
- Modify: `README.md` (if it has setup instructions — check first)

**Step 1: Create `.env.local.example`**

```bash
# Google Custom Search API
# 1. Create API key: https://console.cloud.google.com → APIs & Services → Credentials
# 2. Enable "Custom Search API" for the key
# 3. Create Search Engine: https://programmablesearchengine.google.com
#    Set to "Search the entire web"
GOOGLE_CSE_API_KEY=your_api_key_here
GOOGLE_CSE_CX=your_search_engine_id_here
```

**Step 2: Verify `.env.local` is in `.gitignore`**

```bash
grep env.local .gitignore
```
Expected: `.env*.local` or `.env.local` appears. If not, add it.

**Step 3: Add env vars to Vercel**

```bash
vercel env add GOOGLE_CSE_API_KEY
vercel env add GOOGLE_CSE_CX
```
When prompted, add for Production, Preview, and Development.

**Step 4: Commit the example file**

```bash
git add .env.local.example
git commit -m "docs: add env var example for Google CSE"
```

**Step 5: Run all tests one final time**

```bash
npm test
```
Expected: all 11 tests pass.

**Step 6: Deploy to production**

```bash
vercel --prod
```
Expected: READY status, deployment URL printed.

**Step 7: Push to git**

```bash
git push origin main
```
