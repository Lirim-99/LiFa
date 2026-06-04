#!/usr/bin/env bash
# start.sh — one-command LiFa launcher for macOS / Linux / Git Bash.
#
#   ./start.sh             # start everything (Postgres + BE + FE)
#   STOP_DOCKER=1 ./start.sh  # also stop Postgres when the script ends
#
# Backend → http://localhost:3001
# Frontend → http://localhost:3000

set -e
cd "$(dirname "$0")"

step() { printf '\033[36m==> %s\033[0m\n' "$1"; }
ok()   { printf '\033[32m    %s\033[0m\n' "$1"; }
warn() { printf '\033[33m    %s\033[0m\n' "$1"; }

# --- 1. Docker engine -----------------------------------------------------
step "Checking Docker"
if ! docker info >/dev/null 2>&1; then
  warn "Docker engine not reachable — start Docker Desktop and re-run."
  exit 1
fi
ok "Docker is up"

# --- 2. Postgres container ------------------------------------------------
step "Starting Postgres (docker compose up -d)"
docker compose up -d
ok "Postgres container started"

# --- 3. Wait for Postgres -------------------------------------------------
step "Waiting for Postgres to accept connections"
deadline=$(( $(date +%s) + 30 ))
until docker compose exec -T postgres pg_isready -U lifa -d lifa_dev >/dev/null 2>&1; do
  if [ "$(date +%s)" -gt "$deadline" ]; then
    echo "Postgres never came up." >&2
    exit 1
  fi
  sleep 1
done
ok "Postgres ready"

# --- 4. Apply Prisma migrations ------------------------------------------
step "Applying Prisma migrations"
corepack pnpm --filter backend exec prisma migrate deploy
ok "Schema is current"

# --- 5. Dev servers -------------------------------------------------------
step "Starting dev servers (Ctrl-C to stop both)"
echo "    Backend  → http://localhost:3001"
echo "    Frontend → http://localhost:3000"
echo

cleanup() {
  if [ "${STOP_DOCKER:-0}" = "1" ]; then
    step "Stopping Postgres"
    docker compose down
  fi
}
trap cleanup EXIT

corepack pnpm dev
