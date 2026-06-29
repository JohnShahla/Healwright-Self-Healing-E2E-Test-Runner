import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { RunResult } from './types.js';

// Append-only run history. JSON keeps the project dependency-free and portable;
// swapping in SQLite later is a drop-in change behind this module's interface.
const DIR = join(process.cwd(), '.healwright');
const FILE = join(DIR, 'runs.json');

export function recordRun(run: RunResult): void {
  mkdirSync(DIR, { recursive: true });
  let history: RunResult[] = [];
  if (existsSync(FILE)) {
    try {
      history = JSON.parse(readFileSync(FILE, 'utf8')) as RunResult[];
    } catch {
      history = [];
    }
  }
  history.push(run);
  writeFileSync(FILE, `${JSON.stringify(history, null, 2)}\n`);
}
