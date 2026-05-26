# Step 1 — Monorepo & Dev Environment (tracker)

Use this file to tick off work. Source: `IMPLEMENTATION_PLAN.md` § Step 1.

## Mini-tasks

- [x] **1.1** pnpm workspace at repo root (`pnpm-workspace.yaml`: `backend`, `frontend`, `packages/*`)
- [x] **1.2** NestJS in `backend/` (CLI), health at `GET /health`, port **3001**, `dev` script
- [x] **1.3** Next.js in `frontend/` (CLI), App Router, port **3000**
- [x] **1.4** `packages/shared` (`@lifa/shared`) — placeholder; types come later
- [x] **1.5** Root `docker-compose.yml`: PostgreSQL 16, port **5432**, named volume, dev-only defaults
- [x] **1.6** Prisma in `backend/`: `prisma/schema.prisma` (Postgres datasource + generator), `db push` against Docker DB (run `pnpm db:push` after Docker is up)
- [x] **1.7** Root Prettier + align ESLint story (`.prettierrc.json` + `.prettierignore` at root; per-workspace ESLint; `pnpm lint` / `format:check` clean)
- [x] **1.8** Root `README.md`: prerequisites, `pnpm install`, `docker compose up -d`, Prisma, how to run FE/BE
- [x] **1.9** Git: `.gitignore` complete, first commit done

## Step 1 — Definition of Done (from plan)

- [x] `pnpm install` from root
- [x] `docker compose up -d` → Postgres up
- [x] `pnpm --filter backend dev` → `GET /health` → `{ "status": "ok" }`
- [x] `pnpm --filter frontend dev` → homepage
- [x] `pnpm db:push` → "The database is already in sync with the Prisma schema"
- [x] ESLint + Prettier with **no errors**

---

**Step 1 complete.** Next: Step 2 — full Prisma MVP schema, initial migration, seed script.
