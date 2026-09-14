#!/usr/bin/env bash
# ReNovel dev setup (Phase 0). Idempotent.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT/app"

if [ ! -f .env ]; then
  cp .env.example .env
  echo "created app/.env from .env.example"
fi

echo "installing dependencies..."
bun install

echo "building Tailwind CSS..."
bun run css

echo
echo "setup complete."
echo "  local:   bun run dev        (needs Postgres on localhost:5432)"
echo "  podman:  podman compose -f docker/docker-compose.dev.yml up --build"
echo "           (ensure 'podman machine start' has been run first)"
