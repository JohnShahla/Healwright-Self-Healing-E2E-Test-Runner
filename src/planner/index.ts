import type { Planner } from '../types.js';
import { ClaudePlanner } from './claude.js';
import { HeuristicPlanner } from './heuristic.js';

export type PlannerKind = 'claude' | 'heuristic';

export function createPlanner(kind: PlannerKind): Planner {
  return kind === 'claude' ? new ClaudePlanner() : new HeuristicPlanner();
}
