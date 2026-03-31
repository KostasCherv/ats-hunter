export type SearchHit = {
  url: string
  title: string
  snippet: string
  source?: string
}

type GoogleSerpApiResponse = {
  organic_results?: Array<{
    link?: string
    title?: string
    snippet?: string
  }>
}

type GoogleCseResponse = {
  items?: Array<{
    link?: string
    title?: string
    snippet?: string
  }>
}

type TavilyResponse = {
  results?: Array<{
    url?: string
    title?: string
    content?: string
  }>
}

async function searchWithGoogleSerpApi(query: string, count: number, signal?: AbortSignal): Promise<SearchHit[]> {
  const apiKey = process.env.SERPAPI_API_KEY
  if (!apiKey) {
    throw new Error('SERPAPI_API_KEY is missing')
  }

  const url = new URL('https://serpapi.com/search.json')
  url.searchParams.set('engine', 'google')
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(count))
  url.searchParams.set('api_key', apiKey)

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Google SerpAPI failed (${response.status})`)
  }

  const payload = await response.json() as GoogleSerpApiResponse
  const results = payload.organic_results ?? []
  return results
    .filter((item) => typeof item.link === 'string' && typeof item.title === 'string')
    .map((item) => ({
      url: item.link as string,
      title: (item.title as string).trim(),
      snippet: typeof item.snippet === 'string' ? item.snippet.trim() : '',
      source: 'google-serpapi',
    }))
}

async function searchWithGoogleCse(query: string, count: number, signal?: AbortSignal): Promise<SearchHit[]> {
  const apiKey = process.env.GOOGLE_CSE_API_KEY
  const cx = process.env.GOOGLE_CSE_CX
  if (!apiKey || !cx) {
    throw new Error('GOOGLE_CSE_API_KEY or GOOGLE_CSE_CX is missing')
  }

  const url = new URL('https://www.googleapis.com/customsearch/v1')
  url.searchParams.set('key', apiKey)
  url.searchParams.set('cx', cx)
  url.searchParams.set('q', query)
  url.searchParams.set('num', String(Math.min(count, 10)))

  const response = await fetch(url.toString(), {
    method: 'GET',
    signal,
  })
  if (!response.ok) {
    throw new Error(`Google CSE failed (${response.status})`)
  }

  const payload = await response.json() as GoogleCseResponse
  const results = payload.items ?? []
  return results
    .filter((item) => typeof item.link === 'string' && typeof item.title === 'string')
    .map((item) => ({
      url: item.link as string,
      title: (item.title as string).trim(),
      snippet: typeof item.snippet === 'string' ? item.snippet.trim() : '',
      source: 'google-cse',
    }))
}

async function searchWithTavily(query: string, count: number, signal?: AbortSignal): Promise<SearchHit[]> {
  const apiKey = process.env.TAVILY_API_KEY
  if (!apiKey) {
    throw new Error('TAVILY_API_KEY is missing')
  }

  const response = await fetch('https://api.tavily.com/search', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      query,
      max_results: count,
      search_depth: 'basic',
      include_answer: false,
      include_raw_content: false,
    }),
    signal,
  })
  if (!response.ok) {
    throw new Error(`Tavily failed (${response.status})`)
  }

  const payload = await response.json() as TavilyResponse
  const results = payload.results ?? []
  return results
    .filter((item) => typeof item.url === 'string' && typeof item.title === 'string')
    .map((item) => ({
      url: item.url as string,
      title: (item.title as string).trim(),
      snippet: typeof item.content === 'string' ? item.content.trim() : '',
      source: 'tavily',
    }))
}

export async function searchWeb(query: string, count: number, signal?: AbortSignal): Promise<SearchHit[]> {
  const provider = (process.env.SEARCH_PROVIDER || 'google-serpapi').toLowerCase()
  const runners: Array<() => Promise<SearchHit[]>> = []

  if (provider === 'google-cse') {
    runners.push(() => searchWithGoogleCse(query, count, signal))
  } else if (provider === 'tavily') {
    runners.push(() => searchWithTavily(query, count, signal))
  } else {
    runners.push(() => searchWithGoogleSerpApi(query, count, signal))
  }

  // Optional fallback chain for reliability.
  if (provider !== 'tavily' && process.env.TAVILY_API_KEY) {
    runners.push(() => searchWithTavily(query, count, signal))
  }
  if (provider !== 'google-cse' && process.env.GOOGLE_CSE_API_KEY && process.env.GOOGLE_CSE_CX) {
    runners.push(() => searchWithGoogleCse(query, count, signal))
  }

  let lastError: Error | null = null
  for (const run of runners) {
    try {
      const hits = await run()
      if (hits.length > 0) return hits
    } catch (error) {
      lastError = error instanceof Error ? error : new Error('Search provider failed')
    }
  }
  throw lastError ?? new Error('No search provider available')
}

async function isReachable(url: string): Promise<boolean> {
  const timeoutMs = 3500
  const withTimeout = async (method: 'HEAD' | 'GET') => {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
      })
      return res.ok
    } catch {
      return false
    } finally {
      clearTimeout(timeout)
    }
  }

  const headOk = await withTimeout('HEAD')
  if (headOk) return true
  return withTimeout('GET')
}

export async function filterReachableHits(hits: SearchHit[]): Promise<SearchHit[]> {
  const checks = await Promise.all(
    hits.map(async (hit) => ({ hit, ok: await isReachable(hit.url) }))
  )
  return checks.filter((entry) => entry.ok).map((entry) => entry.hit)
}
