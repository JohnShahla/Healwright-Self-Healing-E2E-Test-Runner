#!/usr/bin/env node
// Load .env before anything else reads process.env (e.g. the Claude planner
// reading ANTHROPIC_API_KEY / HEALWRIGHT_MODEL). This import must come first.
import 'dotenv/config';
import { main } from './cli.js';

main(process.argv)
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
