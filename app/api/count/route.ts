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
        const data = await res.json()
        if (!res.ok) {
          console.error('CSE error:', JSON.stringify(data))
          return [domain, null] as const
        }
        const count = parseInt(data.searchInformation?.totalResults ?? '0', 10)
        return [domain, isNaN(count) ? null : count] as const
      } catch (err) {
        console.error('CSE fetch error:', err)
        return [domain, null] as const
      }
    })
  )

  return NextResponse.json({ counts: Object.fromEntries(results) })
}
