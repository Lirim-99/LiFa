# Deploying LiFa for free

A $0 stack: **Neon** (Postgres) + **Render** (NestJS backend) + **Vercel**
(Next.js frontend). The frontend talks to the backend only **server-side**
(through its BFF proxy, using `BACKEND_API_URL`), so the browser stays
same-origin — **no CORS to configure**.

```
Browser ──HTTPS──> Vercel (Next.js)  ──server-side fetch──>  Render (NestJS API)  ──>  Neon (Postgres)
```

> Read the **Caveats** at the bottom before relying on this for real customers —
> free tiers sleep, and their terms generally exclude commercial production use.

---

## 1. Database — Neon (free Postgres)

1. Create an account at <https://neon.tech> → **New Project** (pick the EU region
   closest to you, e.g. Frankfurt).
2. Copy the **connection string**. Make sure it ends with `?sslmode=require`,
   e.g. `postgresql://USER:PASSWORD@HOST/neondb?sslmode=require`.
3. Keep it handy — it's the `DATABASE_URL` for the backend.

Neon free = 0.5 GB, no expiry. (Avoid Render's own free Postgres — it expires.)

---

## 2. Backend — Render (free web service)

The repo ships a **`render.yaml`** Blueprint, so this is mostly clicks.

1. Push the repo to GitHub.
2. Render → **New → Blueprint** → connect the repo. Render reads `render.yaml`
   and proposes the `lifa-backend` service.
3. Set env vars when prompted:
   - `DATABASE_URL` → your Neon string (from step 1).
   - `JWT_SECRET` → leave it; Render generates a strong value.
   - `JWT_ACCESS_EXPIRES_IN` / `JWT_REFRESH_EXPIRES_IN` → prefilled (`1h` / `7d`).
4. Deploy. The build runs `pnpm build`, then **`prisma migrate deploy`** and the
   **base seed** (roles + Kosovo tax-rate templates — both idempotent).
5. When it's live, note the URL: `https://lifa-backend-XXXX.onrender.com`.
   Check `GET /health` → `{"status":"ok"}`.

(No `render.yaml`? Create a **Web Service** manually with: Build =
`corepack enable && pnpm install --frozen-lockfile && pnpm --filter backend db:generate && pnpm --filter backend build && pnpm --filter backend db:deploy`,
Start = `pnpm --filter backend start:prod`, Health check = `/health`.)

---

## 3. Seed the demo company + users (one-time)

The base seed (step 2) only creates roles + tax templates. To populate the demo
company and the 5 login users, run the **demo** seed **once** against the live DB:

- Render dashboard → `lifa-backend` → **Shell**, then:
  ```bash
  pnpm --filter backend db:seed:demo
  ```
  (or `pnpm db:seed:all` to run base + demo together)

> ⚠️ The demo seed is idempotent — it **wipes and recreates** the demo company
> and the `@lifa.demo` / demo users every run. Run it to refresh demo data, but
> **not** on a database holding real customer data. That's why it isn't in the
> automatic deploy.

### Login credentials (password for all: `Sup3rSecret!`)

| Name | Role | Email |
|------|------|-------|
| Lirim Hoxha | owner | `owner@lifa.demo` |
| Lirim Hasani | admin | `lirim.hasani@lifa.demo` |
| Arta Krasniqi | accountant | `accountant@lifa.demo` |
| Faton Qerimi | accountant | `faton.qerimi@lifa.demo` |
| Vali Berisha | viewer | `viewer@lifa.demo` |

---

## 4. Frontend — Vercel (free)

1. Vercel → **Add New → Project** → import the same GitHub repo.
2. **Root Directory: `frontend`** (Vercel auto-detects Next.js and handles the
   pnpm workspace install from the repo root).
3. Environment Variables:
   - `BACKEND_API_URL` = your Render URL, e.g.
     `https://lifa-backend-XXXX.onrender.com` (no trailing slash).
     This is **server-only** — do **not** prefix with `NEXT_PUBLIC_`.
4. Deploy. Open the Vercel URL → you should see the Albanian login screen.

If you set `BACKEND_API_URL` after the first deploy, **redeploy** the frontend so
it picks up the value.

---

## 5. Verify

- Visit the Vercel URL, switch language (sq/en), and log in as
  `owner@lifa.demo` / `Sup3rSecret!`.
- First request after idle is slow — see Caveats (cold start).

---

## Caveats (read before going "production")

1. **Free services sleep.** Render free spins down after ~15 min idle → the first
   request wakes it (~30–60s). Frontend + backend both sleep, so a cold first
   load is slow. Fine for demos/pilots, not for paying users.
2. **Commercial-use terms.** Vercel Hobby and Render free are intended for
   personal/non-commercial use. A real accounting SaaS with paying customers
   needs paid plans (~$7–25/mo each). Free is great for an MVP/demo.
3. **Free Postgres limits.** Neon free = 0.5 GB + autosuspend.
4. **HTTPS is required** — auth cookies are `secure` in production. Vercel/Render
   provide HTTPS automatically.
5. **Not hardened.** No backups, monitoring, or multi-region. Add those (and a
   paid DB plan with PITR backups) before storing real financial data.
6. **Fiscalization** stays in `MANUAL_EDI`/`NONE` until ATK certification — see
   `FISCALIZATION.md`. No `ANTHROPIC_API_KEY` is needed at runtime.

---

## Custom domain (optional, free)

Both Vercel and Render let you attach a custom domain with free SSL. Point your
domain at the **Vercel** app; keep the Render backend on its `onrender.com` URL
(only the frontend talks to it, server-side).
