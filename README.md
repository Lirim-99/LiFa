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

| App | Command             | URL                   |
| --- | ------------------- | --------------------- |
| API | `pnpm dev:backend`  | http://localhost:3001 |
| Web | `pnpm dev:frontend` | http://localhost:3000 |

Health check: `GET http://localhost:3001/health` → `{ "status": "ok" }`

## Useful scripts

- `pnpm lint` — lint all workspaces
- `pnpm format` — format with Prettier (root)
- `pnpm db:generate` — regenerate Prisma Client after schema changes
- `pnpm db:push` — push schema to DB (dev; use migrations later for production)

## Docs

- Product: `PRODUCT_BRIEF.md`
- Implementation plan: `IMPLEMENTATION_PLAN.md`
- Step 1 checklist: `STEP_1_PROGRESS.md`
