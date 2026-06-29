import type { Page } from 'playwright';
import type { Planner, ResolvedAction } from './types.js';
import { capturePageContext } from './pageContext.js';

/**
 * When a cached action fails, snapshot the changed page and ask the planner to
 * resolve the same step again, passing the broken action so it avoids reusing
 * the dead locator.
 */
export async function heal(
  page: Page,
  step: string,
  failed: ResolvedAction,
  reason: string,
  planner: Planner,
): Promise<ResolvedAction> {
  const ctx = await capturePageContext(page);
  return planner.plan(step, ctx, { previousAttempt: failed, failureReason: reason });
}
