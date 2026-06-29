import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ResolvedAction } from './types.js';

// The compiled plan for each spec lives here: the resolved (and healed) action
// for every step, so reruns are fast and deterministic instead of re-asking the
// model each time. A broken cache entry is what triggers a heal on the next run.
const PLANS_DIR = join(process.cwd(), '.healwright', 'plans');

function slug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'spec';
}

function planFile(name: string): string {
  return join(PLANS_DIR, `${slug(name)}.json`);
}

/** Load the cached plan for a spec, aligned by step index. Null entries mean "unresolved". */
export function loadPlan(name: string): (ResolvedAction | null)[] | null {
  const file = planFile(name);
  if (!existsSync(file)) return null;
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as (ResolvedAction | null)[];
  } catch {
    return null;
  }
}

export function savePlan(name: string, plan: (ResolvedAction | null)[]): void {
  mkdirSync(PLANS_DIR, { recursive: true });
  writeFileSync(planFile(name), `${JSON.stringify(plan, null, 2)}\n`);
}
