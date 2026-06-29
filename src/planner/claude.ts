import Anthropic from '@anthropic-ai/sdk';
import type { LocatorStrategy, PageContext, PageElement, Planner, PlanInput, ResolvedAction } from '../types.js';
import { ACTION_TOOL } from './schema.js';

// Sonnet 4.6 is the default: planning/healing runs once per step, so a fast,
// cheap model is the right fit. Set HEALWRIGHT_MODEL=claude-opus-4-8 for the
// hardest semantic-healing cases. See README → "Why Sonnet by default".
const DEFAULT_MODEL = 'claude-sonnet-4-6';

const SYSTEM = `You convert ONE natural-language step from a browser test into exactly one concrete action by calling the resolve_action tool.

Rules:
- Choose the most ROBUST locator that uniquely identifies the user's intended element. Prefer, in order: role + accessible name, visible text, label, placeholder. Fall back to testid or css only when nothing user-facing works.
- Match the user's INTENT, not the literal markup. If a step says "the Add to cart button" but the only matching control now reads "Add to bag", pick the button that serves that purpose.
- Ground every locator in an element from the page snapshot you are given - do not invent selectors.
- Use kind="goto" for navigation, kind="expectText" for assertions about visible text.
- Always return exactly one action via the tool.`;

export class ClaudePlanner implements Planner {
  readonly name: string;
  private readonly client: Anthropic;
  private readonly model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error(
        'ANTHROPIC_API_KEY is not set. Add it to a .env file (see .env.example) or your environment, ' +
          'or run with `--planner heuristic` for the offline demo.',
      );
    }
    this.model = process.env.HEALWRIGHT_MODEL || DEFAULT_MODEL;
    this.name = `claude (${this.model})`;
    this.client = new Anthropic();
  }

  async plan(step: string, ctx: PageContext, input?: PlanInput): Promise<ResolvedAction> {
    const response = await this.client.messages.create({
      model: this.model,
      max_tokens: 1024,
      system: SYSTEM,
      tools: [ACTION_TOOL as unknown as Anthropic.Tool],
      tool_choice: { type: 'tool', name: ACTION_TOOL.name },
      messages: [{ role: 'user', content: buildPrompt(step, ctx, input) }],
    });

    const block = response.content.find((b) => b.type === 'tool_use');
    if (!block || block.type !== 'tool_use') {
      throw new Error('Claude did not return an action.');
    }
    return normalize(step, block.input as Record<string, unknown>);
  }
}

function buildPrompt(step: string, ctx: PageContext, input?: PlanInput): string {
  let prompt = `Page: ${ctx.title} <${ctx.url}>\n\nInteractive elements:\n${describeElements(ctx.elements)}\n\nStep: ${step}`;
  if (input?.previousAttempt?.locator) {
    prompt +=
      `\n\nThe previous locator FAILED: ${JSON.stringify(input.previousAttempt.locator)}.` +
      ` The page markup has changed. Choose a NEW locator for the same intent from the elements above - do not repeat the failed one.`;
    if (input.failureReason) prompt += `\nFailure detail: ${input.failureReason}`;
  }
  return prompt;
}

function describeElements(elements: PageElement[]): string {
  if (elements.length === 0) return '(no interactive elements captured)';
  return elements
    .map((e, i) => {
      const parts = [`#${i}`, e.tag];
      if (e.role) parts.push(`role=${e.role}`);
      if (e.name) parts.push(`name=${JSON.stringify(e.name)}`);
      else if (e.text) parts.push(`text=${JSON.stringify(e.text.slice(0, 40))}`);
      if (e.testid) parts.push(`testid=${e.testid}`);
      if (e.placeholder) parts.push(`placeholder=${JSON.stringify(e.placeholder)}`);
      if (e.href) parts.push(`href=${e.href}`);
      return parts.join(' ');
    })
    .join('\n');
}

/** Coerce the validated tool input into a ResolvedAction. */
function normalize(step: string, raw: Record<string, unknown>): ResolvedAction {
  const action: ResolvedAction = { kind: raw.kind as ResolvedAction['kind'], description: step };
  if (typeof raw.url === 'string') action.url = raw.url;
  if (typeof raw.text === 'string') action.text = raw.text;
  if (raw.locator && typeof raw.locator === 'object') {
    const l = raw.locator as Record<string, unknown>;
    action.locator = {
      strategy: l.strategy as LocatorStrategy,
      value: String(l.value ?? ''),
      ...(l.name ? { name: String(l.name) } : {}),
    };
  }
  return action;
}
