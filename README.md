# ATS Hunter

Precision Google search query generator across ATS platforms. Find jobs posted directly on Greenhouse, Lever, Ashby, Workday and more — with less competition than LinkedIn/Indeed.

## Deploy to Vercel (2 minutes)

### Option A — Vercel CLI (fastest)
```bash
npm i -g vercel
cd ats-hunter
npm install
vercel
```
Follow the prompts. Done.

### Option B — GitHub + Vercel UI
1. Push this folder to a GitHub repo
2. Go to [vercel.com/new](https://vercel.com/new)
3. Import the repo
4. Framework preset: **Next.js** (auto-detected)
5. Click **Deploy**

Environment variables are required for AI Match (see below).

## Local dev
```bash
npm install
npm run dev
# open http://localhost:3000
```

## Environment variables (AI Match)
Create `.env.local` from `.env.local.example` and set:

- `BRAVE_SEARCH_API_KEY`: Brave Web Search API key
- `OPENAI_API_KEY`: OpenAI key for ranking and explanations
- `OPENAI_MODEL` (optional): defaults to `gpt-4.1-mini`
- `AI_MATCH_ENABLED` (optional): set `false` to disable AI Match instantly

### MVP cost note
- Public visitors can trigger AI matching, and usage is billed to your API keys.
- MVP uses lightweight safeguards (`maxResults` cap + timeout + kill switch) but no hard per-user limits yet.

## How it works
- Enter role titles (comma-separated), location, work type, and skills
- Select ATS platforms
- Queries are generated live using Google boolean syntax: `site:greenhouse.io ("AI Engineer" OR "Backend Engineer") AND "Zurich" AND "hybrid" AND ("LangGraph" OR "Python")`
- Click **Search →** to open Google directly, or **Copy** to paste anywhere
- Click **Match with AI** to rank current results against your profile (summary, skills, location)

## Stack
- Next.js 16 (App Router + API route for AI Match)
- TypeScript
- Brave Search API + OpenAI API (server-side fetch)
