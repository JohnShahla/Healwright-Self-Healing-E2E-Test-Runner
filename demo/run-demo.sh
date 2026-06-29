#!/usr/bin/env bash
# Self-contained self-healing demo. No API key required (uses the offline planner).
#
#   Phase 1: run the test against v1 markup  -> passes, caches a testid selector
#   Phase 2: "deploy" v2 (markup refactored) -> cached selector breaks -> self-heals
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${PORT:-5050}"
SPEC="demo/tests/store.yaml"

echo "==> Ensuring Playwright Chromium is installed (first run only)…"
npx playwright install chromium >/dev/null 2>&1 || \
  echo "    (could not auto-install; run 'npx playwright install chromium' if the demo fails)"

echo "==> Building…"
npm run build >/dev/null

site_pid=""
start_site() { SITE_VERSION="$1" PORT="$PORT" node demo/site/server.mjs & site_pid=$!; sleep 1; }
stop_site() { [ -n "$site_pid" ] && kill "$site_pid" 2>/dev/null || true; site_pid=""; }
trap stop_site EXIT

echo
echo "================ PHASE 1: v1 markup (first run) ================"
echo "Resolves each plain-English step and caches the plan. Expect PASS."
start_site v1
node dist/index.js run "$SPEC" --planner heuristic --fresh || true
stop_site

echo
echo "================ PHASE 2: v2 markup (a refactor shipped) ======="
echo "Same test, no code changes. The cached selector is now broken."
echo "Watch the runner re-resolve it on the fly and report the heal."
start_site v2
node dist/index.js run "$SPEC" --planner heuristic
stop_site

echo
echo "Done. The step that broke under v2 was healed without touching the test."
