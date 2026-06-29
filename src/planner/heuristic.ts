import type { Locator, PageContext, PageElement, Planner, PlanInput, ResolvedAction } from '../types.js';

/**
 * Deterministic offline planner. Maps a step to an action with simple rules and
 * resolves it against the current page snapshot, so it re-resolves on its own
 * when the markup changes without needing an API key. Used by the demo and tests
 * so the heal loop is reproducible offline.
 */
export class HeuristicPlanner implements Planner {
  readonly name = 'heuristic (offline)';

  async plan(step: string, ctx: PageContext, input?: PlanInput): Promise<ResolvedAction> {
    const s = step.toLowerCase().trim();
    const quoted = step.match(/"([^"]+)"|'([^']+)'/);
    const target = quoted ? (quoted[1] ?? quoted[2]) : undefined;

    // Navigation
    if (/^(go|open|navigate|visit|load)\b/.test(s) || s.includes('home page')) {
      const url = step.match(/https?:\/\/\S+/);
      return { kind: 'goto', description: step, url: url ? url[0] : '/' };
    }

    // Assertion ("expect/should/verify ... \"text\"")
    if (/\b(expect|should|verify|assert|see|shows?|displays?)\b/.test(s) && target) {
      return { kind: 'expectText', description: step, text: target };
    }

    // Fill / type
    if (/\b(type|fill|enter|input)\b/.test(s)) {
      return { kind: 'fill', description: step, text: target ?? '', locator: findField(ctx, s) };
    }

    // Click (default for interactive intents, or any step naming a quoted target)
    if (/\b(click|press|tap|select|choose|add|submit|toggle)\b/.test(s) || target) {
      return { kind: 'click', description: step, locator: findClickable(ctx, s, target, input) };
    }

    // Fallback: treat as a visible-text assertion
    return { kind: 'expectText', description: step, text: target ?? step };
  }
}

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'click', 'press', 'tap', 'on', 'button', 'link', 'to', 'of',
  'for', 'please', 'then', 'and', 'in', 'into', 'field', 'box', 'icon',
]);

function keywordsFor(s: string, target?: string): string[] {
  const source = (target ?? s).toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
  return source.split(/\s+/).filter((w) => w && !STOP_WORDS.has(w));
}

function scoreElement(e: PageElement, keywords: string[]): number {
  const haystack = [e.name, e.text, e.testid, e.placeholder, e.role].filter(Boolean).join(' ').toLowerCase();
  if (!haystack) return 0;
  let score = 0;
  for (const k of keywords) if (haystack.includes(k)) score += 2;
  if (e.tag === 'button' || e.role === 'button' || e.tag === 'a') score += 1;
  return score;
}

function findClickable(ctx: PageContext, s: string, target: string | undefined, input?: PlanInput): Locator {
  const keywords = keywordsFor(s, target);
  const ranked = ctx.elements
    .map((e) => ({ e, score: scoreElement(e, keywords) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score);

  const best = ranked[0]?.e ?? ctx.elements.find((e) => e.role === 'button' || e.tag === 'button');
  if (!best) return { strategy: 'text', value: target ?? '' };
  return chooseLocator(best, input?.previousAttempt?.locator);
}

function findField(ctx: PageContext, s: string): Locator {
  const keywords = keywordsFor(s);
  const fields = ctx.elements.filter((e) => e.role === 'textbox' || e.tag === 'input' || e.tag === 'textarea');
  const ranked = fields
    .map((e) => ({ e, score: scoreElement(e, keywords) }))
    .sort((a, b) => b.score - a.score);
  const best = ranked[0]?.e ?? fields[0];
  if (!best) return { strategy: 'css', value: 'input' };
  return chooseLocator(best);
}

/**
 * Produce a ranked list of viable locators for an element and return the first
 * one that isn't the locator that just failed (`avoid`). The ranking - testid
 * first - is what lets the demo cache a brittle selector that later breaks; the
 * `avoid` skip is what makes the re-resolution land on a different, working one.
 */
function chooseLocator(e: PageElement, avoid?: Locator): Locator {
  const options: Locator[] = [];
  if (e.testid) options.push({ strategy: 'testid', value: e.testid });
  if (e.role && e.name) options.push({ strategy: 'role', value: e.role, name: e.name });
  else if (e.tag === 'button' && e.name) options.push({ strategy: 'role', value: 'button', name: e.name });
  const label = e.name ?? e.text;
  if (label) options.push({ strategy: 'text', value: label.trim() });
  if (e.placeholder) options.push({ strategy: 'placeholder', value: e.placeholder });

  for (const option of options) {
    if (avoid && option.strategy === avoid.strategy && option.value === avoid.value) continue;
    return option;
  }
  return options[0] ?? { strategy: 'text', value: (e.name ?? e.text ?? '').trim() };
}
