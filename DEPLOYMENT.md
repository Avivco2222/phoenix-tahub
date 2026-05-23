# Deployment — Phoenix Talent OS

This repo is set up to ship as **two separate Vercel projects** out of the same
monorepo:

| Project                | Subdir              | Runtime                              |
| ---------------------- | ------------------- | ------------------------------------ |
| `phoenix-dashboard`    | `phoenix-dashboard` | Vercel Next.js (Node 20)             |
| `phoenix-backend`      | `backend`           | Vercel Fluid Compute (Python 3.13)   |

Each project has its own `vercel.json` inside its subdirectory; nothing at the
repo root is required by Vercel.

## One-time setup (Vercel dashboard)

You do these steps **once per environment** (prod, preview/staging, etc.).
After that, every `git push` to `main` triggers both deployments
automatically.

### 1. Create the frontend project

1. Vercel dashboard → **Add New Project** → import the GitHub repo.
2. Framework Preset: `Next.js` (auto-detected).
3. **Root Directory**: `phoenix-dashboard`.
4. Build / install commands are inherited from `phoenix-dashboard/vercel.json`
   (`npm run build` / `npm ci`).
5. Environment variables (Production scope):
   - `BACKEND_INTERNAL_URL` → the URL of the **backend** Vercel project,
     e.g. `https://phoenix-backend.vercel.app`. The Next.js rewrites in
     `next.config.ts` proxy `/api/*` to this URL so the browser keeps
     hitting the frontend origin (cookies stay on the same domain).
   - `NODE_ENV=production` is set by Vercel automatically.
6. Deploy.

### 2. Create the backend project

1. Vercel dashboard → **Add New Project** → import the same GitHub repo.
2. Framework Preset: `Other`.
3. **Root Directory**: `backend`.
4. The `backend/vercel.json` declares Python 3.13 + a single function at
   `api/index.py`. The entry shim re-exports the FastAPI app from `main.py`.
5. Environment variables (Production scope):
   - `JWT_SECRET` — generate with
     `python -c "import secrets; print(secrets.token_urlsafe(64))"`.
   - `ENV=production` — activates the destructive-route guard
     (`/admin/reset-for-final-test` returns 410) and switches logging to
     JSON-per-line.
   - `ADMIN_API_TOKEN` — strong random string; used by non-browser
     integrations only.
   - `SESSION_UNLOCK_PIN` — strong random string.
   - `COOKIE_SECURE=1` — backend then sets the session cookie with the
     `Secure` flag, required on HTTPS origins.
   - `CORS_ALLOW_ORIGINS` — set to the frontend's prod URL,
     e.g. `https://phoenix-dashboard.vercel.app`. Comma-separated for
     multiple origins (preview deploys etc.). When the frontend and
     backend share an origin (single-project setup) leave this unset.
   - Optional: `JWT_TTL_MINUTES=480`, `MAX_UPLOAD_MB=10`,
     `MAX_INGEST_ERROR_RATE=0.2`.
6. Deploy.

### 3. Connect them

After both projects are deployed, copy the backend's URL into the
frontend's `BACKEND_INTERNAL_URL` env var and redeploy the frontend.
After that, `https://<frontend>/api/health` should return `{ok: true}`
because the rewrite proxies it through.

## Local development (no Vercel)

```bash
# Terminal 1 — backend
cd backend
cp .env.example .env       # then fill in JWT_SECRET at least
ENV=dev python -m uvicorn main:app --host 127.0.0.1 --port 8010

# Terminal 2 — frontend
cd phoenix-dashboard
npm install
npm run dev                # serves http://localhost:3000
```

`phoenix-dashboard/next.config.ts` rewrites `/api/*` to `127.0.0.1:8010` by
default, so the local frontend talks to the local backend the same way it
talks to the Vercel backend in production.

## CI

`.github/workflows/ci.yml` runs on every PR + push to `main`:

- **frontend**: `npm ci` → `lint` → `typecheck` → `test` → `build` (with
  `NODE_ENV=production` so the production CSP is exercised).
- **backend**: Python 3.13 → install requirements + requirements-dev →
  `pytest -q`, with deterministic env vars (`JWT_SECRET`,
  `ADMIN_API_TOKEN`, `SESSION_UNLOCK_PIN`, `ENV=test`).

Concurrency: a fast follow-up commit cancels the previous in-flight run on
the same branch.

## Database

Currently SQLite (`phoenix_enterprise.db` at repo root). For the Vercel
Fluid Compute deploy this means **the DB resets on every cold start** —
fine for demo / read-only / pre-launch verification, **not fine for real
users**. Migration to Postgres (Supabase / Neon / Vercel Postgres) is the
expected next step before opening the system to live data; see
`DEPLOYMENT_TODO.md` (or the open GitHub issue) for the plan.

## Region

Both `vercel.json` files pin `regions: ["fra1"]` (Frankfurt) on the
assumption the primary audience is in Israel. Change it to your nearest
region if needed:

- US East: `iad1`
- US West: `sfo1`
- Asia Pacific: `sin1` / `hnd1`

Multi-region is a paid feature; the array is required to be a single
region on the free tier.

## Verifying a deploy

```bash
# Health
curl https://<backend>.vercel.app/healthz       # → {"ok": true}
curl https://<backend>.vercel.app/readyz        # → {"ready": true}

# Should be blocked in prod (ENV=production guard)
curl -X POST https://<backend>.vercel.app/admin/reset-for-final-test
# → 410 Gone

# Frontend proxies correctly
curl https://<frontend>.vercel.app/healthz      # → {"ok": true}  (via rewrite)
```

If the frontend returns 502 / 504 from those probes, the most common cause
is a missing or stale `BACKEND_INTERNAL_URL`; redeploy the frontend after
fixing.
