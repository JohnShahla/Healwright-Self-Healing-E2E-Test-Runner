# Healwright

Self-healing end-to-end tests. You write browser tests in plain English, and when a UI change breaks a selector, Healwright re-resolves it against the live page instead of failing the build.

E2E tests are brittle. A front-end tweak renames a class or moves a `<div>`, and a passing suite goes red even though nothing actually broke for users. Healwright compiles each plain-English step into a real [Playwright](https://playwright.dev) action and caches the selectors it resolved. When a cached selector stops matching, a planner looks at the current page and finds the same element a different way.

```yaml
# tests/checkout.yaml
name: Add to cart
baseUrl: http://localhost:5050
steps:
  - go to the store
  - click the "Add to cart" button
  - expect the page to show "Added to cart"
```

```text
$ healwright run tests/checkout.yaml

Add to cart (tests/checkout.yaml)
  ✔ go to the store [cache]
  ⛑ click the "Add to cart" button [cache] → role="button (Add to cart)"
  ✔ expect the page to show "Added to cart" [cache]

⛑  Healing report
  step:  click the "Add to cart" button
    broke: testid="add-cart"
    fixed: role="button (Add to cart)"

PASS  2 passed, 1 healed, 0 failed, 0 skipped
```

## Try the demo (no API key)

```bash
git clone https://github.com/JohnShahla/Healwright-Self-Healing-E2E-Test-Runner.git
cd Healwright-Self-Healing-E2E-Test-Runner
npm install
npx playwright install chromium
npm run demo
```

The demo runs that test against a small bundled site twice. The first run passes and caches its selectors (one of them a `data-testid`). Between runs the page is refactored: the `data-testid` is removed, classes are renamed, and the button text is wrapped in a `<span>`. On the second run the cached selector no longer matches, so Healwright re-resolves it by role and accessible name, the test passes, and it prints what it changed.

`npm run demo:visual` does the same thing and writes `demo/visual-report.html` with a screenshot of each step and the before/after diff. Open it with `open demo/visual-report.html`.

## How it works

```
 plain-English step
        |
        v
   [ planner ]  <--- page snapshot ---  [ live page (Playwright) ]
        |                                        ^
        | resolved action                        |
        v                                        |
   [ executor ] --- run action ------------------+
        |
        |-- ok? yes --> cache it, mark the step passed
        |
        '-- selector broke --> [ healer ] -- re-snapshot, re-resolve --> retry
```

1. The planner turns one plain-English step into a structured action (`{kind, locator, ...}`), using a snapshot of the page's interactive elements (roles, accessible names, text, test ids).
2. The executor maps that action onto Playwright's locator API and runs it.
3. Resolved actions are cached per test, so normal runs are fast and don't call the model again.
4. When a cached action fails, the healer snapshots the changed page and asks the planner to resolve the same step again, telling it which locator just failed so it picks a different one. If the retry works, it records the heal and updates the cache.

The planner prefers durable, user-facing locators (role and accessible name, visible text) over brittle ones like CSS or test ids, following Playwright's own [locator guidance](https://playwright.dev/docs/best-practices). That is usually why a stable replacement exists.

## Planners

There are two, behind one interface:

- `claude` (default when `ANTHROPIC_API_KEY` is set) uses the Anthropic API. It handles structural changes and semantic ones, like a button relabelled from "Add to cart" to "Add to bag".
- `heuristic` (offline, no key) re-resolves from the live DOM with a deterministic ranking. It powers the demo so the loop is reproducible without a key.

Both produce the same action shape, so the runner, executor, healer, and cache do not care which one is used.

To see a semantic heal, run the demo once to cache a plan, then serve the `v3` page (button relabelled "Add to bag") with the Claude planner:

```bash
npm run build
SITE_VERSION=v3 PORT=5050 node demo/site/server.mjs &
npm run healwright -- run demo/tests/store.yaml --planner claude
```

## Usage

```bash
healwright run <spec.yaml...> [options]

  --planner <claude|heuristic>  Default: claude if ANTHROPIC_API_KEY is set, else heuristic.
  --base-url <url>              Override the spec's baseUrl.
  --headed                      Run with a visible browser.
  --no-heal                     Fail on a broken selector instead of healing.
  --fresh                       Ignore the cached plan and re-resolve every step.
  --timeout <ms>                Per-step timeout (default 5000).
  --screenshots <dir>           Save a screenshot after each step.
```

A spec is YAML: a name, an optional baseUrl, and a list of plain-English steps. Steps cover navigation (`go to ...`), clicks (`click the "X" button`), typing (`type "alice" into the username field`), and assertions (`expect the page to show "X"`). Quote the literal text to match.

## Getting started

Requires Node.js 18 or newer.

```bash
npm install
npx playwright install chromium
npm run build
```

```bash
npm run healwright -- run demo/tests/store.yaml
# or after `npm link`:  healwright run demo/tests/store.yaml
```

## Using your own API key

The heuristic planner needs no key. The Claude planner needs your own [Anthropic API key](https://console.anthropic.com/settings/keys):

```bash
cp .env.example .env
# set ANTHROPIC_API_KEY=sk-ant-... in .env
npm run healwright -- run demo/tests/store.yaml --planner claude
```

`.env` is loaded automatically and is git-ignored, so the key never gets committed. You can also pass it inline:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm run healwright -- run <spec> --planner claude
```

Set `HEALWRIGHT_MODEL` to choose the model (default `claude-sonnet-4-6`; `claude-opus-4-8` for the hardest cases). The model is only called to resolve a new step or heal a broken one, so cached runs make no API calls.

## Project layout

```
src/
  types.ts        Shared types
  spec.ts         Load YAML specs
  pageContext.ts  Snapshot the live page for the planner
  planner/
    schema.ts     Tool schema for the model
    claude.ts     Anthropic-backed planner
    heuristic.ts  Offline planner
  executor.ts     Run an action via Playwright
  healer.ts       Re-resolve a broken step
  cache.ts        Per-spec plan cache
  store.ts        Run history
  runner.ts       The plan / execute / heal loop
  report.ts       Terminal output
  cli.ts          CLI
demo/             Bundled site (v1/v2/v3) and demo scripts
```

## Notes

- The Claude planner forces a single tool call so the model returns schema-valid JSON, instead of parsing free text.
- Sonnet is the default because planning runs once per step and wants to be fast and cheap. `claude-opus-4-8` is there for harder cases.
- Plan cache and run history are plain JSON to keep things dependency-free and easy to inspect.

## Roadmap

- More step types (dropdowns, hovers, waits).
- A small dashboard over the run history (heal frequency, flakiest steps).
- Visual-diff regression alongside selector healing.
- A mode that opens a PR updating brittle selectors in the source.

## License

MIT
