import type { Locator, RunResult, StepResult } from './types.js';

const C = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
};

function fmtLocator(l?: Locator): string {
  if (!l) return '-';
  const value = l.name ? `${l.value} (${l.name})` : l.value;
  return `${l.strategy}=${JSON.stringify(value)}`;
}

export function printRun(run: RunResult): void {
  console.log(`\n${C.bold}${run.name}${C.reset} ${C.dim}(${run.spec})${C.reset}`);
  for (const step of run.steps) console.log(formatStep(step));

  if (run.healCount > 0) {
    console.log(`\n${C.yellow}${C.bold}⛑  Healing report${C.reset}`);
    for (const step of run.steps.filter((s) => s.status === 'healed')) {
      console.log(`  ${C.dim}step:${C.reset}  ${step.step}`);
      console.log(`    ${C.red}broke:${C.reset} ${fmtLocator(step.healedFrom)}`);
      console.log(`    ${C.green}fixed:${C.reset} ${fmtLocator(step.action?.locator)}`);
    }
  }

  const count = (status: StepResult['status']) => run.steps.filter((s) => s.status === status).length;
  const verdict = run.passed ? `${C.green}PASS${C.reset}` : `${C.red}FAIL${C.reset}`;
  console.log(
    `\n${verdict}  ${count('passed')} passed, ${run.healCount} healed, ${count('failed')} failed, ${count('skipped')} skipped`,
  );
}

function formatStep(s: StepResult): string {
  const icon =
    s.status === 'passed' ? `${C.green}✔${C.reset}`
    : s.status === 'healed' ? `${C.yellow}⛑${C.reset}`
    : s.status === 'failed' ? `${C.red}✖${C.reset}`
    : `${C.dim}‣${C.reset}`;
  const cacheTag = s.fromCache ? ` ${C.dim}[cache]${C.reset}` : '';
  let line = `  ${icon} ${s.step}${cacheTag}`;
  if (s.status === 'healed') line += ` ${C.dim}→ ${fmtLocator(s.action?.locator)}${C.reset}`;
  if (s.status === 'failed' && s.error) line += `\n      ${C.red}${s.error}${C.reset}`;
  return line;
}
