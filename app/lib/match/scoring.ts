import type { SearchHit } from './search'

type MatchProfile = {
  summary?: string
  skills: string[]
  location?: string
}

export type MatchResult = {
  url: string
  title: string
  company: string
  score: number
  reason: string
  snippet?: string
}

type OpenAiResponse = {
  choices?: Array<{
    message?: {
      content?: string
    }
  }>
}

type ParsedMatch = {
  url?: unknown
  title?: unknown
  company?: unknown
  score?: unknown
  reason?: unknown
}

function fallbackScore(hit: SearchHit, profile: MatchProfile): MatchResult {
  const text = `${hit.title} ${hit.snippet}`.toLowerCase()
  let score = 45
  for (const skill of profile.skills) {
    if (text.includes(skill.toLowerCase())) score += 12
  }
  if (profile.location && text.includes(profile.location.toLowerCase())) score += 10
  if (profile.summary) {
    const topWord = profile.summary.toLowerCase().split(/\W+/).find(Boolean)
    if (topWord && text.includes(topWord)) score += 8
  }

  const host = (() => {
    try {
      return new URL(hit.url).hostname
    } catch {
      return 'Unknown'
    }
  })()

  return {
    url: hit.url,
    title: hit.title,
    company: host,
    score: Math.min(100, score),
    reason: 'Fallback ranking based on skill/location keyword overlap.',
    snippet: hit.snippet,
  }
}

function validateMatches(raw: unknown, hits: SearchHit[]): MatchResult[] {
  if (!Array.isArray(raw)) return []
  const hitByUrl = new Map(hits.map((hit) => [hit.url, hit]))
  const out: MatchResult[] = []
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue
    const candidate = entry as ParsedMatch
    if (typeof candidate.url !== 'string') continue
    const source = hitByUrl.get(candidate.url)
    if (!source) continue
    const title = typeof candidate.title === 'string' ? candidate.title : source.title
    const company = typeof candidate.company === 'string' ? candidate.company : (() => {
      try {
        return new URL(source.url).hostname
      } catch {
        return 'Unknown'
      }
    })()
    const reason = typeof candidate.reason === 'string' ? candidate.reason : 'Strong profile match.'
    const scoreRaw = typeof candidate.score === 'number' ? candidate.score : 50
    out.push({
      url: source.url,
      title,
      company,
      reason,
      score: Math.max(0, Math.min(100, Math.round(scoreRaw))),
      snippet: source.snippet,
    })
  }
  return out
}

export async function rankMatchesWithLlm(hits: SearchHit[], profile: MatchProfile, signal?: AbortSignal): Promise<MatchResult[]> {
  const apiKey = process.env.OPENAI_API_KEY
  const model = process.env.OPENAI_MODEL || 'gpt-4.1-mini'
  if (!apiKey) {
    return hits.map((hit) => fallbackScore(hit, profile)).sort((a, b) => b.score - a.score)
  }

  const prompt = [
    'Rank these job search results by fit to this profile.',
    'Return ONLY valid JSON array with items: {url,title,company,score,reason}.',
    'score must be 0-100.',
    `Profile summary: ${profile.summary || 'N/A'}`,
    `Profile skills: ${profile.skills.join(', ') || 'N/A'}`,
    `Preferred location: ${profile.location || 'N/A'}`,
    `Results: ${JSON.stringify(hits)}`,
  ].join('\n')

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.1,
      messages: [
        {
          role: 'system',
          content: 'You are a strict JSON ranking engine.',
        },
        {
          role: 'user',
          content: prompt,
        },
      ],
    }),
    signal,
  })

  if (!response.ok) {
    return hits.map((hit) => fallbackScore(hit, profile)).sort((a, b) => b.score - a.score)
  }

  const data = await response.json() as OpenAiResponse
  const content = data.choices?.[0]?.message?.content
  if (!content) {
    return hits.map((hit) => fallbackScore(hit, profile)).sort((a, b) => b.score - a.score)
  }

  try {
    const parsed = JSON.parse(content) as unknown
    const validated = validateMatches(parsed, hits)
    if (validated.length === 0) throw new Error('No valid matches')
    return validated.sort((a, b) => b.score - a.score)
  } catch {
    return hits.map((hit) => fallbackScore(hit, profile)).sort((a, b) => b.score - a.score)
  }
}
