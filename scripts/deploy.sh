#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/.."

GAMESTATS_REPOSITORY="${GAMESTATS_REPOSITORY:-https://github.com/Kenneth-11/gamestats.git}"
GAMESTATS_REF="${GAMESTATS_REF:-feature/gameconsole-integration}"
GAMESTATS_PATH="../GameStats"

if [[ "${SKIP_GIT_PULL:-0}" != "1" ]]; then
    if [[ -d .git ]]; then
        git pull --ff-only
    fi

    if [[ -d "$GAMESTATS_PATH/.git" ]]; then
        git -C "$GAMESTATS_PATH" fetch --depth 1 origin "$GAMESTATS_REF"
        git -C "$GAMESTATS_PATH" checkout --detach FETCH_HEAD
    else
        git clone --depth 1 --branch "$GAMESTATS_REF" \
            "$GAMESTATS_REPOSITORY" "$GAMESTATS_PATH"
    fi
fi

docker compose config --quiet
docker compose up -d --build --wait
docker compose ps

echo
echo "GameConsole disponible en: http://localhost:${WEB_PORT:-8088}"
echo "Smoke test: BASE_URL=http://localhost:${WEB_PORT:-8088} node scripts/smoke.mjs"
