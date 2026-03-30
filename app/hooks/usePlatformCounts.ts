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
