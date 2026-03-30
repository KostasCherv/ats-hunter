import { renderHook, act } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest'
import { usePlatformCounts } from '../usePlatformCounts'

const mockFetch = vi.fn()

beforeEach(() => {
  vi.useFakeTimers()
  vi.stubGlobal('fetch', mockFetch)
  mockFetch.mockReset()
  // Default: return empty counts so tests that don't assert fetch responses don't crash
  mockFetch.mockResolvedValue({
    ok: true,
    json: async () => ({ counts: {} }),
  })
})

afterEach(() => vi.useRealTimers())

describe('usePlatformCounts', () => {
  it('starts with empty counts and loading false after initial fetch', async () => {
    const { result } = renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, true)
    )
    await act(async () => { await vi.runAllTimersAsync() })
    expect(result.current.counts).toEqual({})
    expect(result.current.loading).toBe(false)
  })

  it('does not fetch when disabled', async () => {
    renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, false)
    )
    await act(async () => { await vi.runAllTimersAsync() })
    expect(mockFetch).not.toHaveBeenCalled()
  })

  it('fetches on mount and updates counts', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ counts: { 'greenhouse.io': 142 } }),
    })
    const { result } = renderHook(() =>
      usePlatformCounts({ 'greenhouse.io': 'site:greenhouse.io "AI"' }, true)
    )
    await act(async () => { await vi.runAllTimersAsync() })
    expect(result.current.counts['greenhouse.io']).toBe(142)
    expect(result.current.loading).toBe(false)
  })
})
