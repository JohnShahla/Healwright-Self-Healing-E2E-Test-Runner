// Core data model shared across the runner, planners, executor and healer.

/** The concrete browser operations Healwright knows how to perform. */
export type ActionKind = 'goto' | 'click' | 'fill' | 'expectText' | 'expectVisible';

/** Locator strategies, mapped 1:1 onto Playwright's locator API in executor.ts. */
export type LocatorStrategy = 'role' | 'text' | 'label' | 'placeholder' | 'testid' | 'css';

/** A resolved way to find one element on the page. */
export interface Locator {
  strategy: LocatorStrategy;
  /** Role name ('button'), visible text, label, placeholder, data-testid, or a CSS selector. */
  value: string;
  /** Accessible name - only meaningful with strategy 'role'. */
  name?: string;
}

/**
 * A natural-language step compiled into one concrete action.
 * This is what gets cached and replayed; healing produces a new one of these.
 */
export interface ResolvedAction {
  kind: ActionKind;
  /** The natural-language step this action fulfils (its intent). */
  description: string;
  /** Target element. Absent for `goto`. */
  locator?: Locator;
  /** Destination for `goto`. */
  url?: string;
  /** Value to type for `fill`, or the text to assert for `expectText`. */
  text?: string;
}

/** A test as authored on disk. */
export interface TestSpec {
  name: string;
  baseUrl?: string;
  steps: string[];
  /** Source path, for reporting. */
  file: string;
}

/** A single interactive/landmark element captured from the live page. */
export interface PageElement {
  tag: string;
  role?: string;
  name?: string;
  text?: string;
  id?: string;
  testid?: string;
  placeholder?: string;
  href?: string;
}

/** A compact, serialisable snapshot of the page handed to a planner. */
export interface PageContext {
  url: string;
  title: string;
  elements: PageElement[];
}

/** Extra signal a planner can use when re-resolving a broken step. */
export interface PlanInput {
  /** The action that just failed - so the planner avoids repeating a dead locator. */
  previousAttempt?: ResolvedAction;
  /** Why it failed (e.g. a Playwright timeout message). */
  failureReason?: string;
}

/** A planner turns one natural-language step into one ResolvedAction. */
export interface Planner {
  readonly name: string;
  plan(step: string, ctx: PageContext, input?: PlanInput): Promise<ResolvedAction>;
}

export type StepStatus = 'passed' | 'healed' | 'failed' | 'skipped';

export interface StepResult {
  index: number;
  step: string;
  status: StepStatus;
  action?: ResolvedAction;
  /** The locator that broke, when the step was healed. */
  healedFrom?: Locator;
  error?: string;
  /** Whether the action came from the cached plan (vs freshly resolved). */
  fromCache: boolean;
  durationMs: number;
  /** Path to a screenshot captured after this step, when screenshots are enabled. */
  screenshot?: string;
}

export interface RunResult {
  spec: string;
  name: string;
  startedAt: string;
  steps: StepResult[];
  passed: boolean;
  healCount: number;
}
