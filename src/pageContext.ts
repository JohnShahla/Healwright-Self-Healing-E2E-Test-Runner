import type { Page } from 'playwright';
import type { PageContext } from './types.js';

/**
 * Capture a compact, serialisable snapshot of the live page: the interactive
 * and landmark elements with their roles, accessible names, text, and the
 * attributes a locator might key off (id, data-testid, placeholder).
 *
 * This is what a planner "sees" - both when first resolving a step and when
 * healing one - so it stays grounded in elements that actually exist right now.
 */
export async function capturePageContext(page: Page, max = 60): Promise<PageContext> {
  const data = await page.evaluate((limit) => {
    function roleOf(el: Element): string | undefined {
      const explicit = el.getAttribute('role');
      if (explicit) return explicit;
      const tag = el.tagName.toLowerCase();
      if (tag === 'button') return 'button';
      if (tag === 'a' && (el as HTMLAnchorElement).getAttribute('href')) return 'link';
      if (tag === 'input') {
        const t = (el as HTMLInputElement).type;
        if (t === 'checkbox') return 'checkbox';
        if (t === 'radio') return 'radio';
        if (t === 'submit' || t === 'button') return 'button';
        return 'textbox';
      }
      if (tag === 'select') return 'combobox';
      if (tag === 'textarea') return 'textbox';
      if (/^h[1-6]$/.test(tag)) return 'heading';
      return undefined;
    }

    const selector = 'a,button,input,select,textarea,[role],[data-testid],h1,h2,h3,p';
    const elements: Record<string, unknown>[] = [];
    for (const el of Array.from(document.querySelectorAll(selector))) {
      const he = el as HTMLElement;
      const style = window.getComputedStyle(he);
      if (style.display === 'none' || style.visibility === 'hidden') continue;

      const text = (he.innerText || he.textContent || '').trim().replace(/\s+/g, ' ');
      const ariaLabel = he.getAttribute('aria-label') || undefined;
      const role = roleOf(el);
      const name = ariaLabel || (text && text.length <= 60 ? text : undefined);

      const e: Record<string, unknown> = { tag: el.tagName.toLowerCase() };
      if (role) e.role = role;
      if (name) e.name = name;
      if (text && text !== name) e.text = text.slice(0, 80);
      if (he.id) e.id = he.id;
      const testid = he.getAttribute('data-testid');
      if (testid) e.testid = testid;
      const placeholder = he.getAttribute('placeholder');
      if (placeholder) e.placeholder = placeholder;
      if (el.tagName.toLowerCase() === 'a') {
        const href = (el as HTMLAnchorElement).getAttribute('href');
        if (href) e.href = href;
      }

      elements.push(e);
      if (elements.length >= limit) break;
    }

    return { url: location.href, title: document.title, elements };
  }, max);

  return data as unknown as PageContext;
}
