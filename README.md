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

No environment variables needed. Fully static export.

## Local dev
```bash
npm install
npm run dev
# open http://localhost:3000
```

## How it works
- Enter role titles (comma-separated), location, work type, and skills
- Select ATS platforms
- Queries are generated live using Google boolean syntax: `site:greenhouse.io ("AI Engineer" OR "Backend Engineer") AND "Zurich" AND "hybrid" AND ("LangGraph" OR "Python")`
- Click **Search →** to open Google directly, or **Copy** to paste anywhere

## Stack
- Next.js 14 (static export, no server)
- TypeScript
- Zero dependencies beyond Next.js
