# start.ps1 — one-command LiFa launcher for Windows / PowerShell.
#
#   .\start.ps1            # default: start everything
#   .\start.ps1 -StopDocker # also stop Postgres when the script ends
#
# What it does, in order:
#   1. Verifies Docker Desktop is running (starts it if not).
#   2. Brings up the Postgres container (docker compose up -d).
#   3. Waits until Postgres accepts connections.
#   4. Applies any pending Prisma migrations.
#   5. Runs `pnpm dev` (concurrently runs backend + frontend).
#
# Backend → http://localhost:3001
# Frontend → http://localhost:3000

param(
  [switch]$StopDocker
)

$ErrorActionPreference = "Stop"
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $scriptDir

function Write-Step($msg) { Write-Host "==> $msg" -ForegroundColor Cyan }
function Write-Ok($msg)   { Write-Host "    $msg" -ForegroundColor Green }
function Write-Warn($msg) { Write-Host "    $msg" -ForegroundColor Yellow }

# --- 1. Docker Desktop ----------------------------------------------------
Write-Step "Checking Docker"
$dockerProc = Get-Process "Docker Desktop" -ErrorAction SilentlyContinue
if (-not $dockerProc) {
  Write-Warn "Docker Desktop not running — starting it"
  $dockerExe = "$env:ProgramFiles\Docker\Docker\Docker Desktop.exe"
  if (-not (Test-Path $dockerExe)) {
    throw "Docker Desktop not found at $dockerExe. Install Docker Desktop or start it manually."
  }
  Start-Process $dockerExe
  Write-Warn "Waiting for Docker engine to be ready (up to 90s)..."
  $deadline = (Get-Date).AddSeconds(90)
  while ((Get-Date) -lt $deadline) {
    try { docker info 2>$null | Out-Null; if ($LASTEXITCODE -eq 0) { break } } catch {}
    Start-Sleep -Seconds 2
  }
  docker info 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Docker engine didn't come up in time." }
}
Write-Ok "Docker is up"

# --- 2. Postgres container ------------------------------------------------
Write-Step "Starting Postgres (docker compose up -d)"
docker compose up -d
if ($LASTEXITCODE -ne 0) { throw "docker compose failed" }
Write-Ok "Postgres container started"

# --- 3. Wait for Postgres to accept connections --------------------------
Write-Step "Waiting for Postgres to accept connections"
$deadline = (Get-Date).AddSeconds(30)
while ((Get-Date) -lt $deadline) {
  docker compose exec -T postgres pg_isready -U lifa -d lifa_dev 2>$null | Out-Null
  if ($LASTEXITCODE -eq 0) { break }
  Start-Sleep -Seconds 1
}
if ($LASTEXITCODE -ne 0) { throw "Postgres never came up." }
Write-Ok "Postgres ready"

# --- 4. Apply Prisma migrations ------------------------------------------
Write-Step "Applying Prisma migrations (prisma migrate deploy)"
corepack pnpm --filter backend exec prisma migrate deploy
if ($LASTEXITCODE -ne 0) { throw "prisma migrate deploy failed" }
Write-Ok "Schema is current"

# --- 5. Run backend + frontend in one terminal ---------------------------
Write-Step "Starting dev servers (Ctrl-C to stop both)"
Write-Host "    Backend  → http://localhost:3001" -ForegroundColor Green
Write-Host "    Frontend → http://localhost:3000" -ForegroundColor Green
Write-Host ""

try {
  corepack pnpm dev
} finally {
  if ($StopDocker) {
    Write-Step "Stopping Postgres"
    docker compose down
  }
}
