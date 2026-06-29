import { createPlanner, type PlannerKind } from './planner/index.js';
import { loadSpec } from './spec.js';
import { runSpec } from './runner.js';
import { printRun } from './report.js';
import { recordRun } from './store.js';
import type { RunResult } from './types.js';

const HELP = `healwright - self-healing end-to-end tests in plain English

Usage:
  healwright run <spec.yaml...> [options]

Options:
  --planner <claude|heuristic>  Backend. Default: claude if ANTHROPIC_API_KEY is set, else heuristic.
  --base-url <url>              Override the spec's baseUrl for navigation steps.
  --headed                      Run with a visible browser window.
  --no-heal                     Disable self-healing (fail on a broken selector).
  --fresh                       Ignore the cached plan and re-resolve every step.
  --timeout <ms>                Per-step timeout. Default: 5000.
  --screenshots <dir>           Save a screenshot after each step into <dir>.
  -h, --help                    Show this help.

Examples:
  healwright run tests/checkout.yaml
  ANTHROPIC_API_KEY=… healwright run "tests/*.yaml" --planner claude
  npm run demo                  Run the bundled self-healing demo (no API key needed).
`;

interface ParsedArgs {
  specs: string[];
  planner?: PlannerKind;
  baseUrl?: string;
  headed?: boolean;
  heal?: boolean;
  fresh?: boolean;
  timeout?: number;
  screenshotDir?: string;
}

export async function main(argv: string[]): Promise<number> {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === '-h' || args[0] === '--help') {
    console.log(HELP);
    return 0;
  }
  if (args[0] !== 'run') {
    console.error(`Unknown command: ${args[0]}\n`);
    console.log(HELP);
    return 1;
  }

  const parsed = parseArgs(args.slice(1));
  if ('error' in parsed) {
    console.error(parsed.error);
    return 1;
  }
  if (parsed.specs.length === 0) {
    console.error('No spec files given.\n');
    console.log(HELP);
    return 1;
  }

  let kind = parsed.planner;
  if (!kind) {
    // No planner explicitly chosen: use Claude if the user has set their own
    // key, otherwise fall back to the offline planner and tell them how to
    // enable Claude with their own key.
    kind = process.env.ANTHROPIC_API_KEY ? 'claude' : 'heuristic';
    if (kind === 'heuristic') {
      console.log('No ANTHROPIC_API_KEY found - using the offline heuristic planner.');
      console.log('To use the Claude planner, set your own key in .env (see .env.example), then re-run with --planner claude.');
    }
  }

  let planner;
  try {
    planner = createPlanner(kind);
  } catch (error) {
    console.error((error as Error).message);
    return 1;
  }

  console.log(`planner: ${planner.name}${parsed.heal === false ? '  (healing disabled)' : ''}`);

  const results: RunResult[] = [];
  for (const file of parsed.specs) {
    try {
      const spec = loadSpec(file);
      const run = await runSpec(spec, {
        planner,
        baseUrl: parsed.baseUrl,
        headed: parsed.headed,
        heal: parsed.heal,
        fresh: parsed.fresh,
        timeout: parsed.timeout,
        screenshotDir: parsed.screenshotDir,
      });
      printRun(run);
      recordRun(run);
      results.push(run);
    } catch (error) {
      console.error(`✖ ${file}: ${(error as Error).message}`);
      results.push({ spec: file, name: file, startedAt: new Date().toISOString(), steps: [], passed: false, healCount: 0 });
    }
  }

  return results.every((r) => r.passed) ? 0 : 1;
}

function parseArgs(args: string[]): ParsedArgs | { error: string } {
  const parsed: ParsedArgs = { specs: [] };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--planner': {
        const value = args[++i];
        if (value !== 'claude' && value !== 'heuristic') return { error: `Invalid --planner: ${value}` };
        parsed.planner = value;
        break;
      }
      case '--base-url':
        parsed.baseUrl = args[++i];
        break;
      case '--headed':
        parsed.headed = true;
        break;
      case '--no-heal':
        parsed.heal = false;
        break;
      case '--fresh':
        parsed.fresh = true;
        break;
      case '--screenshots':
        parsed.screenshotDir = args[++i];
        break;
      case '--timeout': {
        const ms = Number(args[++i]);
        if (!Number.isFinite(ms) || ms <= 0) return { error: `Invalid --timeout: ${args[i]}` };
        parsed.timeout = ms;
        break;
      }
      case '-h':
      case '--help':
        console.log(HELP);
        process.exit(0);
      // eslint-disable-next-line no-fallthrough
      default:
        if (arg.startsWith('--')) return { error: `Unknown option: ${arg}` };
        parsed.specs.push(arg);
    }
  }
  return parsed;
}
