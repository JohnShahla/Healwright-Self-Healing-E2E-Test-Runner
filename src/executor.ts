import type { Page, Locator as PlaywrightLocator } from 'playwright';
import type { Locator, ResolvedAction } from './types.js';

/** Map our strategy-agnostic Locator onto a concrete Playwright locator. */
export function buildLocator(page: Page, l: Locator): PlaywrightLocator {
  switch (l.strategy) {
    case 'role':
      // Role values come straight from the planner; Playwright validates them.
      return page.getByRole(l.value as Parameters<Page['getByRole']>[0], l.name ? { name: l.name } : undefined);
    case 'text':
      return page.getByText(l.value);
    case 'label':
      return page.getByLabel(l.value);
    case 'placeholder':
      return page.getByPlaceholder(l.value);
    case 'testid':
      return page.getByTestId(l.value);
    case 'css':
      return page.locator(l.value);
  }
}

/**
 * Execute one resolved action against the page. Throws on failure (a missing
 * element, a timeout, a failed assertion) - the runner turns that throw into a
 * healing attempt.
 */
export async function execute(page: Page, action: ResolvedAction, timeout: number): Promise<void> {
  switch (action.kind) {
    case 'goto': {
      if (!action.url) throw new Error('goto action is missing a url');
      await page.goto(action.url, { waitUntil: 'domcontentloaded', timeout });
      return;
    }
    case 'click': {
      await requireLocator(page, action).first().click({ timeout });
      return;
    }
    case 'fill': {
      await requireLocator(page, action).first().fill(action.text ?? '', { timeout });
      return;
    }
    case 'expectVisible': {
      await requireLocator(page, action).first().waitFor({ state: 'visible', timeout });
      return;
    }
    case 'expectText': {
      // A scoped locator if given, otherwise a page-wide text match.
      const loc = action.locator ? buildLocator(page, action.locator) : page.getByText(action.text ?? '');
      await loc.first().waitFor({ state: 'visible', timeout });
      return;
    }
  }
}

function requireLocator(page: Page, action: ResolvedAction): PlaywrightLocator {
  if (!action.locator) throw new Error(`${action.kind} action is missing a locator`);
  return buildLocator(page, action.locator);
}
