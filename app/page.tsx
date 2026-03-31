'use client'

import { useState, useCallback, useEffect } from 'react'
import styles from './page.module.css'

const ATS_PLATFORMS = [
  { label: 'Greenhouse', domain: 'greenhouse.io' },
  { label: 'Lever', domain: 'jobs.lever.co' },
  { label: 'SmartRecruiters', domain: 'jobs.smartrecruiters.com' },
  { label: 'Workday', domain: 'wd1.myworkdayjobs.com' },
  { label: 'BambooHR', domain: 'jobs.bamboohr.com' },
  { label: 'Jobvite', domain: 'jobs.jobvite.com' },
  { label: 'iCIMS', domain: 'careers.icims.com' },
  { label: 'Jazz HR', domain: 'apply.jazz.co' },
  { label: 'Workable', domain: 'careers.workable.com' },
  { label: 'Ashby', domain: 'jobs.ashbyhq.com' },
  { label: 'Rippling', domain: 'ats.rippling.com' },
  { label: 'Personio', domain: 'job.personio.de' },
  { label: 'Recruitee', domain: 'careers.recruitee.com' },
  { label: 'Welcome to the Jungle', domain: 'welcometothejungle.com' },
]

const WORK_TYPES = [
  { label: 'Hybrid', value: 'hybrid' },
  { label: 'Remote', value: 'remote' },
  { label: 'On-site', value: 'on-site' },
  { label: 'Any', value: '' },
]

const FRESHNESS_OPTIONS = [
  { label: '24 hours', value: '24h' },
  { label: '7 days', value: '7d' },
  { label: '30 days', value: '30d' },
] as const

const DEFAULT_TITLES = 'AI Engineer, Backend Engineer'
const DEFAULT_LOCATION = 'Zurich'
const DEFAULT_WORK_TYPE = 'hybrid'
const DEFAULT_KEYWORDS = ['LangGraph', 'FastAPI', 'Python']
const DEFAULT_SELECTED_DOMAINS = [
  'greenhouse.io',
  'jobs.lever.co',
  'jobs.smartrecruiters.com',
  'jobs.ashbyhq.com',
  'careers.workable.com',
]
const DEFAULT_FRESHNESS: Freshness = '7d'
const FORM_STORAGE_KEY = 'ats-hunter:form:v1'

const VALID_WORK_TYPES = new Set(WORK_TYPES.map((w) => w.value))
const VALID_FRESHNESS = new Set(FRESHNESS_OPTIONS.map((o) => o.value))
const VALID_DOMAINS = new Set(ATS_PLATFORMS.map((a) => a.domain))

type CopyState = Record<string, boolean>
type Freshness = (typeof FRESHNESS_OPTIONS)[number]['value']

type StoredFormState = {
  titles: string
  location: string
  workType: string
  keywords: string[]
  selected: string[]
  freshness: Freshness
}

function getDefaultFormState(): StoredFormState {
  return {
    titles: DEFAULT_TITLES,
    location: DEFAULT_LOCATION,
    workType: DEFAULT_WORK_TYPE,
    keywords: [...DEFAULT_KEYWORDS],
    selected: [...DEFAULT_SELECTED_DOMAINS],
    freshness: DEFAULT_FRESHNESS,
  }
}

function sanitizeStoredState(raw: unknown): StoredFormState {
  const fallback = getDefaultFormState()
  if (!raw || typeof raw !== 'object') return fallback
  const parsed = raw as Partial<StoredFormState>

  const titles = typeof parsed.titles === 'string' ? parsed.titles : fallback.titles
  const location = typeof parsed.location === 'string' ? parsed.location : fallback.location
  const workType = typeof parsed.workType === 'string' && VALID_WORK_TYPES.has(parsed.workType)
    ? parsed.workType
    : fallback.workType

  const keywords = Array.isArray(parsed.keywords)
    ? parsed.keywords.filter((kw): kw is string => typeof kw === 'string').map((kw) => kw.trim()).filter(Boolean)
    : fallback.keywords

  const selected = Array.isArray(parsed.selected)
    ? parsed.selected.filter((domain): domain is string => typeof domain === 'string' && VALID_DOMAINS.has(domain))
    : fallback.selected

  const freshness = typeof parsed.freshness === 'string' && VALID_FRESHNESS.has(parsed.freshness as Freshness)
    ? parsed.freshness as Freshness
    : fallback.freshness

  return {
    titles,
    location,
    workType,
    keywords: keywords.length ? keywords : fallback.keywords,
    selected: selected.length ? selected : fallback.selected,
    freshness,
  }
}

function getInitialFormState(): StoredFormState {
  const fallback = getDefaultFormState()
  if (typeof window === 'undefined') return fallback
  try {
    const raw = window.localStorage.getItem(FORM_STORAGE_KEY)
    if (!raw) return fallback
    return sanitizeStoredState(JSON.parse(raw))
  } catch {
    return fallback
  }
}

function mapFreshnessToTbs(freshness: Freshness): string {
  if (freshness === '24h') return 'qdr:d'
  if (freshness === '30d') return 'qdr:m'
  return 'qdr:w'
}

export default function Home() {
  const initial = getInitialFormState()
  const [titles, setTitles] = useState(initial.titles)
  const [location, setLocation] = useState(initial.location)
  const [workType, setWorkType] = useState(initial.workType)
  const [keywords, setKeywords] = useState<string[]>(initial.keywords)
  const [freshness, setFreshness] = useState<Freshness>(initial.freshness)
  const [kwInput, setKwInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set(initial.selected))
  const [copied, setCopied] = useState<CopyState>({})

  const addKeyword = useCallback(() => {
    const v = kwInput.replace(/,/g, '').trim()
    if (v && !keywords.includes(v)) setKeywords(prev => [...prev, v])
    setKwInput('')
  }, [kwInput, keywords])

  const removeKeyword = (kw: string) => setKeywords(prev => prev.filter(k => k !== kw))

  const toggleAts = (domain: string) => {
    setSelected(prev => {
      const next = new Set(prev)
      next.has(domain) ? next.delete(domain) : next.add(domain)
      return next
    })
  }

  const buildQuery = (domain: string | null) => {
    const titleList = titles.split(',').map(s => s.trim()).filter(Boolean)
    if (!titleList.length) return ''
    const titlesPart = titleList.length === 1
      ? `"${titleList[0]}"`
      : '(' + titleList.map(t => `"${t}"`).join(' OR ') + ')'
    const locPart = location.trim() ? ` AND "${location.trim()}"` : ''
    const workPart = workType ? ` AND "${workType}"` : ''
    const kwPart = keywords.length
      ? ' AND (' + keywords.map(k => `"${k}"`).join(' OR ') + ')' : ''

    if (domain) {
      return `site:${domain} ${titlesPart}${locPart}${workPart}${kwPart}`
    } else {
      const domains = [...selected]
      const sitePart = domains.length === 1
        ? `site:${domains[0]}`
        : `site:(${domains.join(' OR ')})`
      return `${sitePart} ${titlesPart}${locPart}${workPart}${kwPart}`
    }
  }

  const openSearch = (query: string, fresh: Freshness) => {
    const url = new URL('https://www.google.com/search')
    url.searchParams.set('q', query)
    url.searchParams.set('tbs', mapFreshnessToTbs(fresh))
    window.open(url.toString(), '_blank')
  }

  const copyQuery = async (key: string, query: string) => {
    await navigator.clipboard.writeText(query)
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 1800)
  }

  const selectedDomains = [...selected]
  const hasConfig = selectedDomains.length > 0 && titles.trim().length > 0

  useEffect(() => {
    const state: StoredFormState = {
      titles,
      location,
      workType,
      keywords,
      selected: [...selected],
      freshness,
    }
    window.localStorage.setItem(FORM_STORAGE_KEY, JSON.stringify(state))
  }, [titles, location, workType, keywords, selected, freshness])

  return (
    <div className={styles.root}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.logo}>
            <span className={styles.logoMark}>◈</span>
            <span className={styles.logoText}>ATS Hunter</span>
          </div>
          <p className={styles.tagline}>Precision job search across every ATS platform</p>
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.grid}>

          {/* LEFT COLUMN */}
          <div className={styles.leftCol}>

            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Target role</h2>

              <div className={styles.field}>
                <label className={styles.label}>Job titles</label>
                <input
                  type="text"
                  value={titles}
                  onChange={e => setTitles(e.target.value)}
                  placeholder="AI Engineer, ML Engineer, LLM Engineer"
                />
                <span className={styles.hint}>Comma-separated, joined with OR</span>
              </div>

              <div className={styles.fieldRow}>
                <div className={styles.field}>
                  <label className={styles.label}>Location</label>
                  <input
                    type="text"
                    value={location}
                    onChange={e => setLocation(e.target.value)}
                    placeholder="Zurich, Berlin..."
                  />
                </div>
                <div className={styles.field}>
                  <label className={styles.label}>Work type</label>
                  <div className={styles.pills}>
                    {WORK_TYPES.map(w => (
                      <button
                        key={w.value}
                        className={`${styles.pill} ${workType === w.value ? styles.pillActive : ''}`}
                        onClick={() => setWorkType(w.value)}
                      >{w.label}</button>
                    ))}
                  </div>
                </div>
              </div>

              <div className={`${styles.field} ${styles.fieldCompact}`}>
                <label className={styles.label}>Freshness</label>
                <div className={styles.pills}>
                  {FRESHNESS_OPTIONS.map(option => (
                    <button
                      key={option.value}
                      className={`${styles.pill} ${freshness === option.value ? styles.pillActive : ''}`}
                      onClick={() => setFreshness(option.value)}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className={styles.field}>
                <label className={styles.label}>Skills / keywords</label>
                <div className={styles.kwRow}>
                  <input
                    type="text"
                    value={kwInput}
                    onChange={e => setKwInput(e.target.value)}
                    onKeyDown={e => (e.key === 'Enter' || e.key === ',') && (e.preventDefault(), addKeyword())}
                    placeholder="Python, LangGraph, RAG..."
                  />
                  <button className={styles.addBtn} onClick={addKeyword}>Add</button>
                </div>
                {keywords.length > 0 && (
                  <div className={styles.tags}>
                    {keywords.map(kw => (
                      <span key={kw} className={styles.tag}>
                        {kw}
                        <button className={styles.tagX} onClick={() => removeKeyword(kw)}>×</button>
                      </span>
                    ))}
                  </div>
                )}
                <span className={styles.hint}>Joined with OR — any match counts</span>
              </div>
            </section>

            <section className={styles.card}>
              <div className={styles.cardTitleRow}>
                <h2 className={styles.cardTitle}>ATS platforms</h2>
                <div className={styles.miniActions}>
                  <button className={styles.textBtn} onClick={() => setSelected(new Set(ATS_PLATFORMS.map(a => a.domain)))}>All</button>
                  <button className={styles.textBtn} onClick={() => setSelected(new Set())}>None</button>
                  {hasConfig && (
                    <button
                      className={styles.textBtn}
                      onClick={() => {
                        selectedDomains.forEach((domain) => openSearch(buildQuery(domain), freshness))
                      }}
                    >
                      Open all ↗
                    </button>
                  )}
                </div>
              </div>
              <div className={styles.atsGrid}>
                {ATS_PLATFORMS.map(a => (
                  <button
                    key={a.domain}
                    className={`${styles.atsItem} ${selected.has(a.domain) ? styles.atsSelected : ''}`}
                    onClick={() => toggleAts(a.domain)}
                  >
                    <span className={styles.atsDot} />
                    <span>{a.label}</span>
                  </button>
                ))}
              </div>
            </section>
          </div>

          {/* RIGHT COLUMN */}
          <div className={styles.rightCol}>
            <section className={styles.card}>
              <h2 className={styles.cardTitle}>Generated queries</h2>

              {!hasConfig && (
                <p className={styles.empty}>Configure role and select platforms to generate queries.</p>
              )}

              {hasConfig && (
                <>
                  {selectedDomains.length > 1 && (() => {
                    const q = buildQuery(null)
                    return (
                      <div className={styles.queryBlock}>
                        <div className={styles.queryHeader}>
                          <span className={styles.queryLabel}>
                            <span className={styles.accentDot} />
                            All {selectedDomains.length} platforms
                          </span>
                          <div className={styles.queryActions}>
                            <button className={styles.actionBtn} onClick={() => copyQuery('combined', q)}>
                              {copied['combined'] ? '✓ Copied' : 'Copy'}
                            </button>
                            <button className={`${styles.actionBtn} ${styles.searchBtn}`} onClick={() => openSearch(q, freshness)}>
                              Search →
                            </button>
                          </div>
                        </div>
                        <div className={styles.queryCode}>{q}</div>
                      </div>
                    )
                  })()}

                  <div className={styles.divider} />

                  {selectedDomains.map(domain => {
                    const q = buildQuery(domain)
                    const platform = ATS_PLATFORMS.find(a => a.domain === domain)
                    return (
                      <div key={domain} className={styles.queryBlock}>
                        <div className={styles.queryHeader}>
                          <span className={styles.queryLabel}>{platform?.label ?? domain}</span>
                          <div className={styles.queryActions}>
                            <button className={styles.actionBtn} onClick={() => copyQuery(domain, q)}>
                              {copied[domain] ? '✓ Copied' : 'Copy'}
                            </button>
                            <button className={`${styles.actionBtn} ${styles.searchBtn}`} onClick={() => openSearch(q, freshness)}>
                              Search →
                            </button>
                          </div>
                        </div>
                        <div className={styles.queryCode}>{q}</div>
                      </div>
                    )
                  })}
                </>
              )}
            </section>

            <div className={styles.tip}>
              <span className={styles.tipIcon}>↳</span>
              Google supports up to 32 words and 2,024 characters per query. Keep keyword lists focused for best results.
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
