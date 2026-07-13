# cei-analyzer-api

Secure proxy for the DeepSeek API used by the CEI Pattern Analyzer
(Nurcahya Priantoro skripsi, IPB University).

## Why

Previously the React app on Firebase Hosting called DeepSeek directly,
which exposed the API key in the browser bundle. This Vercel function
hides the key server-side.

## Stack

- Vercel Serverless Functions (`/api/analyze.js`)
- Node.js 20, ES Modules
- Env var: `DEEPSEEK_API_KEY`

## Local development

```bash
npm install -g vercel
vercel dev
# Then POST http://localhost:3000/api/analyze
```

## Deploy

```bash
vercel                 # preview
vercel --prod          # production
```

Set the API key in Vercel dashboard (or `vercel env add DEEPSEEK_API_KEY production`).

## Endpoint

```
POST /api/analyze
Content-Type: application/json

{ "code": "pragma solidity 0.8.28; contract C { ... }" }
```

Returns `{ success: true, data: <parsed JSON> }` or `{ error: "..." }`.