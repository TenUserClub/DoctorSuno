# DoctorSuno

Static site + functional dashboard with a natively integrated AI medical scribe.

## Structure

- `index.html`, `style.css`, `script.js` — marketing site (doctorsuno.com)
- `demo/` — dashboard (revamped UI). The Scribe view is now native (`demo/scribe.js`, `demo/scribe.css`) — no iframe.
- `server/` — scribe backend (Express + TypeScript): ASR → LLM summary → email share
- `api/index.ts` — Vercel serverless entry point; all `/api/*`, `/health`, and `/api-docs` requests are rewritten here (see `vercel.json`)

Because the API is deployed in the same Vercel project as the site, the dashboard calls it same-origin — no CORS setup needed in production.

## Environment variables (Vercel → Settings → Environment Variables)

`GROQ_API_KEY`, `SARVAM_API_KEY`, `OPENAI_API_KEY`, `MAILGUN_API_KEY`, `MAILGUN_DOMAIN`, `MAILGUN_FROM_EMAIL` (see `.env.example`).

## Local development

```bash
npm install
cp .env.example .env   # fill in keys
npm run dev            # API on http://localhost:8000
```

Then serve the static files (e.g. VS Code Live Server) and point the dashboard at the local API by adding this before `scribe.js` loads, or in the console:

```js
window.SCRIBE_API_BASE = "http://localhost:8000";
```

On Vercel (production and preview deploys) no configuration is needed — the API is same-origin.

## Notes

- Vercel request body limit is ~4.5 MB on the free plan; long recordings may need a paid plan (backend itself accepts up to 20 MB).
- API docs available at `/api-docs`.
