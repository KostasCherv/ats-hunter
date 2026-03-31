import { NextRequest, NextResponse } from 'next/server'
import { filterReachableHits, searchWeb } from '@/app/lib/match/search'
import { rankMatchesWithLlm } from '@/app/lib/match/scoring'

export const maxDuration = 60

type ProfileInput = {
  summary?: string
  skills?: string[]
  location?: string
}

type RequestBody = {
  query?: string
  profile?: ProfileInput
  maxResults?: number
}

function isFeatureEnabled(): boolean {
  return process.env.AI_MATCH_ENABLED !== 'false'
}

function parseBody(body: unknown): { query: string; profile: { summary?: string; skills: string[]; location?: string }; maxResults: number } | null {
  if (!body || typeof body !== 'object') return null
  const candidate = body as RequestBody
  if (typeof candidate.query !== 'string' || candidate.query.trim().length < 3) return null
  const profile = candidate.profile ?? {}
  const skills = Array.isArray(profile.skills)
    ? profile.skills.filter((s): s is string => typeof s === 'string').map((s) => s.trim()).filter(Boolean)
    : []
  const maxResults = typeof candidate.maxResults === 'number'
    ? Math.max(1, Math.min(20, Math.round(candidate.maxResults)))
    : 12
  return {
    query: candidate.query.trim(),
    profile: {
      summary: typeof profile.summary === 'string' ? profile.summary.trim() : undefined,
      location: typeof profile.location === 'string' ? profile.location.trim() : undefined,
      skills,
    },
    maxResults,
  }
}

export async function POST(req: NextRequest) {
  if (!isFeatureEnabled()) {
    return NextResponse.json({ error: 'AI matching is temporarily disabled.' }, { status: 503 })
  }

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON payload.' }, { status: 400 })
  }

  const parsed = parseBody(body)
  if (!parsed) {
    return NextResponse.json({ error: 'Invalid payload. Provide query, profile, and maxResults.' }, { status: 400 })
  }

  const startedAt = Date.now()
  const abortController = new AbortController()
  const timeoutMs = 26000
  const timeout = setTimeout(() => abortController.abort(), timeoutMs)

  try {
    const hits = await searchWeb(parsed.query, parsed.maxResults, abortController.signal)
    if (hits.length === 0) {
      return NextResponse.json({ matches: [] })
    }

    // Exclude stale/dead listings to avoid returning broken URLs.
    const reachableHits = await filterReachableHits(hits)
    const effectiveHits = reachableHits.length > 0 ? reachableHits : hits
    const matches = await rankMatchesWithLlm(effectiveHits, parsed.profile, abortController.signal)

    console.info('[ai-match]', JSON.stringify({
      event: 'match_completed',
      latencyMs: Date.now() - startedAt,
      queryLength: parsed.query.length,
      maxResults: parsed.maxResults,
      returnedHits: hits.length,
      reachableHits: reachableHits.length,
      returnedMatches: matches.length,
      model: process.env.OPENAI_MODEL || 'gpt-4.1-mini',
    }))

    return NextResponse.json({ matches })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'
    const status = message.includes('aborted') ? 504 : 500
    console.error('[ai-match]', JSON.stringify({
      event: 'match_failed',
      latencyMs: Date.now() - startedAt,
      reason: message,
    }))
    return NextResponse.json(
      { error: status === 504 ? 'AI matching timed out. Try again.' : 'Unable to match right now.' },
      { status }
    )
  } finally {
    clearTimeout(timeout)
  }
}
