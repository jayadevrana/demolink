#!/usr/bin/env node
import { main } from '../src/cli.js';
import { log } from '../src/log.js';

main(process.argv.slice(2)).catch((err) => {
  // Top-level safety net: print a clean message instead of a raw stack trace.
  const msg = err && err.message ? err.message : String(err);
  log.plain('');
  log.err(msg);
  if (process.env.DEMOLINK_DEBUG) console.error(err);
  process.exit(1);
});
