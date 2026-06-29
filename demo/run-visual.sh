#!/usr/bin/env bash
# Like run-demo.sh, but captures a screenshot after every step and assembles a
# single self-contained visual report (demo/visual-report.html) you can open.
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-5050}"
SPEC="demo/tests/store.yaml"

npx playwright install chromium >/dev/null 2>&1 || true
echo "==> Building…"
npm run build >/dev/null
rm -rf demo/.visual

site_pid=""
start_site() { SITE_VERSION="$1" PORT="$PORT" node demo/site/server.mjs & site_pid=$!; sleep 1; }
stop_site() { [ -n "$site_pid" ] && kill "$site_pid" 2>/dev/null || true; site_pid=""; }
trap stop_site EXIT

echo "==> Phase 1: original page (caches the plan)"
start_site v1
node dist/index.js run "$SPEC" --planner heuristic --fresh --screenshots demo/.visual/phase1 || true
stop_site

echo "==> Phase 2: refactored page (selector breaks -> self-heals)"
start_site v2
node dist/index.js run "$SPEC" --planner heuristic --screenshots demo/.visual/phase2
stop_site

echo "==> Building visual report…"
node demo/build-report.mjs
echo
echo "Open it:  open demo/visual-report.html"
