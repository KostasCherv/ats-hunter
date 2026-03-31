export type SearchHit = {
  url: string
  title: string
  snippet: string
  source?: string
}

type BraveWebItem = {
  url?: string
  title?: string
  description?: string
}

type BraveResponse = {
  web?: {
    results?: BraveWebItem[]
  }
}

export async function searchWeb(query: string, count: number, signal?: AbortSignal): Promise<SearchHit[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY
  if (!apiKey) {
    throw new Error('BRAVE_SEARCH_API_KEY is missing')
  }

  const url = new URL('https://api.search.brave.com/res/v1/web/search')
  url.searchParams.set('q', query)
  url.searchParams.set('count', String(count))

  const response = await fetch(url.toString(), {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'X-Subscription-Token': apiKey,
    },
    signal,
  })

  if (!response.ok) {
    throw new Error(`Brave search failed (${response.status})`)
  }

  const payload = await response.json() as BraveResponse
  const results = payload.web?.results ?? []
  return results
    .filter((item) => typeof item.url === 'string' && typeof item.title === 'string')
    .map((item) => ({
      url: item.url as string,
      title: (item.title as string).trim(),
      snippet: typeof item.description === 'string' ? item.description.trim() : '',
      source: 'brave',
    }))
}
