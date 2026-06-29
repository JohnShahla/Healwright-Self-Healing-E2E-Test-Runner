import { mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { chromium } from 'playwright';
import type { Planner, ResolvedAction, RunResult, StepResult, TestSpec } from './types.js';
import { capturePageContext } from './pageContext.js';
import { execute } from './executor.js';
import { heal } from './healer.js';
import { loadPlan, savePlan } from './cache.js';

export interface RunOptions {
  planner: Planner;
  baseUrl?: string;
  headed?: boolean;
  /** Self-healing on by default; pass false to fail hard on broken selectors. */
  heal?: boolean;
  /** Ignore the cached plan and re-resolve every step. */
  fresh?: boolean;
  /** Per-step timeout in ms. */
  timeout?: number;
  /** If set, save a screenshot after each step into this directory. */
  screenshotDir?: string;
  onStep?: (result: StepResult) => void;
}

export async function runSpec(spec: TestSpec, opts: RunOptions): Promise<RunResult> {
  const timeout = opts.timeout ?? 5000;
  const healingEnabled = opts.heal !== false;
  const baseUrl = opts.baseUrl ?? spec.baseUrl;

  const cached = opts.fresh ? null : loadPlan(spec.name);
  const plan: (ResolvedAction | null)[] = cached ? [...cached] : [];

  const browser = await chromium.launch({ headless: !opts.headed });
  const page = await browser.newPage();

  const steps: StepResult[] = [];
  const startedAt = new Date().toISOString();
  let aborted = false;

  try {
    for (let i = 0; i < spec.steps.length; i++) {
      const step = spec.steps[i];

      // A hard failure aborts the rest of the test - later steps depend on it.
      if (aborted) {
        steps.push(makeSkipped(i, step));
        opts.onStep?.(steps[i]);
        continue;
      }

      const result = await runStep(page, spec, i, step, plan, opts, timeout, healingEnabled, baseUrl);
      if (opts.screenshotDir && result.status !== 'skipped') {
        try {
          mkdirSync(opts.screenshotDir, { recursive: true });
          const file = join(opts.screenshotDir, `step-${i + 1}-${result.status}.png`);
          await page.screenshot({ path: file });
          result.screenshot = file;
        } catch {
          // a screenshot failure should never fail the run
        }
      }
      steps.push(result);
      opts.onStep?.(result);
      if (result.status === 'failed') aborted = true;
    }
  } finally {
    await browser.close();
  }

  if (plan.some(Boolean)) savePlan(spec.name, plan);

  const healCount = steps.filter((s) => s.status === 'healed').length;
  return {
    spec: spec.file,
    name: spec.name,
    startedAt,
    steps,
    passed: steps.every((s) => s.status === 'passed' || s.status === 'healed'),
    healCount,
  };
}

async function runStep(
  page: import('playwright').Page,
  spec: TestSpec,
  index: number,
  step: string,
  plan: (ResolvedAction | null)[],
  opts: RunOptions,
  timeout: number,
  healingEnabled: boolean,
  baseUrl?: string,
): Promise<StepResult> {
  const startedAt = Date.now();
  let action = plan[index] ?? null;
  const fromCache = action !== null;

  try {
    if (!action) {
      const ctx = await capturePageContext(page);
      action = await opts.planner.plan(step, ctx);
    }
    action = withBaseUrl(action, baseUrl);

    try {
      await execute(page, action, timeout);
      plan[index] = action;
      return finish(index, step, 'passed', { action, fromCache, startedAt });
    } catch (firstError) {
      if (!healingEnabled) throw firstError;

      // Self-heal: re-resolve the same intent against the current page.
      const broke = action.locator;
      const healed = withBaseUrl(await heal(page, step, action, firstMessage(firstError), opts.planner), baseUrl);
      await execute(page, healed, timeout); // throws again if the heal didn't work
      plan[index] = healed;
      return finish(index, step, 'healed', { action: healed, healedFrom: broke, fromCache, startedAt });
    }
  } catch (error) {
    return finish(index, step, 'failed', {
      action: action ?? undefined,
      error: firstMessage(error),
      fromCache,
      startedAt,
    });
  }
}

/** Resolve relative / placeholder goto URLs against the effective base URL. */
function withBaseUrl(action: ResolvedAction, baseUrl?: string): ResolvedAction {
  if (action.kind !== 'goto' || !baseUrl) return action;
  const url = action.url ?? '';
  const base = baseUrl.replace(/\/$/, '');
  if (!url || url === '/') return { ...action, url: `${base}/` };
  if (url.startsWith('/')) return { ...action, url: base + url };
  if (!/^https?:\/\//.test(url)) return { ...action, url: `${base}/` };
  return action;
}

function finish(
  index: number,
  step: string,
  status: StepResult['status'],
  extra: Partial<StepResult> & { startedAt: number; fromCache: boolean },
): StepResult {
  const { startedAt, ...rest } = extra;
  return { index, step, status, durationMs: Date.now() - startedAt, ...rest } as StepResult;
}

function makeSkipped(index: number, step: string): StepResult {
  return { index, step, status: 'skipped', fromCache: false, durationMs: 0 };
}

function firstMessage(error: unknown): string {
  return error instanceof Error ? error.message.split('\n')[0] : String(error);
}
