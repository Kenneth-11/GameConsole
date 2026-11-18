#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

if [[ -d .git && "${SKIP_GIT_PULL:-0}" != "1" ]]; then
    git pull --ff-only
fi

docker compose up -d --build
docker compose ps

echo
echo "GameConsole disponible en: http://localhost:${WEB_PORT:-8088}"
echo "Smoke test: BASE_URL=http://localhost:${WEB_PORT:-8088} node scripts/smoke.mjs"
