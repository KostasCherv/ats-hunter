# Design: Live Result Counts per ATS Platform

**Date:** 2026-03-30
**Status:** Approved

## Problem

Users have no signal about how many job listings match their criteria on each ATS platform. They must open Google searches manually to find out, which is slow and breaks focus.

## Goal

Display an estimated result count next to each ATS platform chip, updating live as the user changes job titles, location, work type, or keywords.

## Solution

Add a server-side API route that proxies debounced count requests to the Google Custom Search API, returning estimated result counts per platform.

## Architecture

```
Browser (debounced 500ms on input change)
  → POST /api/count  { queries: Record<domain, queryString> }
  → Server fans out parallel fetch() to Google Custom Search API
  → Returns Record<domain, number | null>
  → UI renders count badges next to each platform chip
```

## Dropping Static Export

Remove `output: 'export'` from `next.config.js`. The app becomes a standard Vercel serverless project. No other infrastructure changes required — no database, no auth.

## API Route: `POST /api/count`

**Input:**
```ts
{ queries: Record<string, string> }  // domain → query string
```

**Behavior:**
- Validates input — rejects if >15 domains submitted
- Fans out `Promise.all()` to Google Custom Search API, one request per domain
- Each CSE request uses `num=1` (we only need `totalResults`, not actual results)
- Returns per-domain count or `null` on error/quota exceeded

**Output:**
```ts
{ counts: Record<string, number | null> }
```

**Environment variables required:**
- `GOOGLE_CSE_API_KEY` — Google API key with Custom Search enabled
- `GOOGLE_CSE_CX` — Programmable Search Engine ID (configured to search the entire web)

## Frontend Changes

### Debounce Hook
- Watches `titles`, `location`, `workType`, `keywords`, `selected`
- Fires 500ms after last change
- Calls `POST /api/count` with current queries for all selected platforms

### Platform Chip UI
- Each chip displays a count badge: `Greenhouse · 142`
- Spinner shown while loading
- `—` shown if count is null (quota exceeded or error)

### "Open All" Button
- Opens all selected platforms in parallel tabs with one click
- Added alongside existing per-platform "Search →" buttons

## Quota

Google Custom Search API free tier: 100 queries/day.
With 14 platforms selected, each full refresh costs 14 queries (~7 refreshes/day free).
Paid tier: $5 per 1,000 additional queries.

Graceful degradation: if the API returns a quota error, counts show `—` and the app remains fully functional.

## Out of Scope

- Caching counts across sessions
- Auth or per-user quota management
- Fetching actual job listings (not just counts)
- Profile persistence (separate future feature)
