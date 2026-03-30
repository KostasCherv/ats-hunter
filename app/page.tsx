'use client'

import { useState, useCallback, useMemo } from 'react'
import styles from './page.module.css'
import { usePlatformCounts } from './hooks/usePlatformCounts'

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

type CopyState = Record<string, boolean>

export default function Home() {
  const [titles, setTitles] = useState('AI Engineer, Backend Engineer')
  const [location, setLocation] = useState('Zurich')
  const [workType, setWorkType] = useState('hybrid')
  const [keywords, setKeywords] = useState<string[]>(['LangGraph', 'FastAPI', 'Python'])
  const [kwInput, setKwInput] = useState('')
  const [selected, setSelected] = useState<Set<string>>(
    new Set(['greenhouse.io', 'jobs.lever.co', 'jobs.smartrecruiters.com', 'jobs.ashbyhq.com', 'careers.workable.com'])
  )
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

  const openSearch = (query: string) => {
    window.open('https://www.google.com/search?q=' + encodeURIComponent(query), '_blank')
  }

  const copyQuery = async (key: string, query: string) => {
    await navigator.clipboard.writeText(query)
    setCopied(prev => ({ ...prev, [key]: true }))
    setTimeout(() => setCopied(prev => ({ ...prev, [key]: false })), 1800)
  }

  const selectedDomains = [...selected]
  const hasConfig = selectedDomains.length > 0 && titles.trim().length > 0

  const queries = useMemo(() => {
    return Object.fromEntries(
      selectedDomains.map((domain) => [domain, buildQuery(domain)])
    )
  }, [selected, titles, location, workType, keywords])

  const { counts, loading } = usePlatformCounts(queries, hasConfig)

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
                        selectedDomains.forEach((domain) => openSearch(buildQuery(domain)))
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
                            <button className={`${styles.actionBtn} ${styles.searchBtn}`} onClick={() => openSearch(q)}>
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
                            <button className={`${styles.actionBtn} ${styles.searchBtn}`} onClick={() => openSearch(q)}>
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
