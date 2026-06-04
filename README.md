# LiFa

Kosovo-first accounting SaaS for SMEs — monorepo (Next.js + NestJS + PostgreSQL).

## Prerequisites

- Node.js 20+
- [pnpm](https://pnpm.io/) 10+
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for local PostgreSQL)

## Setup

```bash
pnpm install
```

### Database (local)

1. Start Docker Desktop, then from the repo root:

   ```bash
   docker compose up -d
   ```

2. Configure the backend connection string:

   ```bash
   copy backend\.env.example backend\.env
   ```

   (On macOS/Linux: `cp backend/.env.example backend/.env`)

3. Apply the Prisma schema to the database (empty schema for now — models come in Step 2):

   ```bash
   pnpm db:push
   ```

   Or: `pnpm --filter backend db:push`

## Run apps

### Quick start (one command)

The `start` scripts handle Docker + migrations + both dev servers in one go.

```powershell
# Windows / PowerShell
.\start.ps1
```

```bash
# macOS / Linux / Git Bash
./start.sh
```

What it does: starts Docker Desktop if needed → brings up the Postgres container → waits until it's ready → applies pending Prisma migrations → runs backend + frontend concurrently with prefixed output. Ctrl-C stops both. Pass `-StopDocker` (PowerShell) or `STOP_DOCKER=1` (bash) to also stop Postgres on exit.

### Manual

```bash
docker compose up -d         # Postgres
pnpm db:migrate              # apply migrations (first run only)
pnpm dev                     # backend + frontend, concurrent + prefixed output
```

Or one workspace at a time:

| App | Command             | URL                   |
| --- | ------------------- | --------------------- |
| API | `pnpm dev:backend`  | http://localhost:3001 |
| Web | `pnpm dev:frontend` | http://localhost:3000 |

Health check: `GET http://localhost:3001/health` → `{ "status": "ok" }`

## Useful scripts

- `pnpm dev` — run backend + frontend concurrently (BE/FE prefixed, color-coded)
- `pnpm lint` — lint all workspaces
- `pnpm format` — format with Prettier (root)
- `pnpm db:generate` — regenerate Prisma Client after schema changes
- `pnpm db:migrate` — apply pending Prisma migrations
- `pnpm db:seed` — seed roles + system tax-rate templates
- `pnpm db:studio` — open Prisma Studio

## Docs

- Product: `PRODUCT_BRIEF.md`
- Implementation plan: `IMPLEMENTATION_PLAN.md`
- Step 1 checklist: `STEP_1_PROGRESS.md`
