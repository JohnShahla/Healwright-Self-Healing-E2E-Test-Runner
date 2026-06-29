import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import yaml from 'js-yaml';
import type { TestSpec } from './types.js';

/** Load and validate a YAML test spec from disk. */
export function loadSpec(file: string): TestSpec {
  const raw = yaml.load(readFileSync(file, 'utf8')) as Record<string, unknown> | null;
  if (!raw || typeof raw !== 'object') {
    throw new Error(`Invalid spec (expected a YAML object): ${file}`);
  }
  const steps = Array.isArray(raw.steps) ? raw.steps.map((s) => String(s)) : [];
  if (steps.length === 0) {
    throw new Error(`Spec has no steps: ${file}`);
  }
  return {
    name: typeof raw.name === 'string' && raw.name.trim() ? raw.name : basename(file),
    baseUrl: typeof raw.baseUrl === 'string' ? raw.baseUrl : undefined,
    steps,
    file,
  };
}
