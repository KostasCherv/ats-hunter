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
  const apiKey = process.env.BRAVE_SEARCH_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'Search not configured' }, { status: 500 })
  }

  const entries = Object.entries(queries)
  const results = await Promise.all(
    entries.map(async ([domain, query]) => {
      try {
        const url = new URL('https://api.search.brave.com/res/v1/web/search')
        url.searchParams.set('q', query)
        url.searchParams.set('count', '1')
        const res = await fetch(url.toString(), {
          headers: {
            'Accept': 'application/json',
            'Accept-Encoding': 'gzip',
            'X-Subscription-Token': apiKey,
          },
        })
        if (!res.ok) return [domain, null] as const
        const data = await res.json()
        const count = data.web?.totalCount ?? null
        return [domain, count] as const
      } catch {
        return [domain, null] as const
      }
    })
  )

  return NextResponse.json({ counts: Object.fromEntries(results) })
}
