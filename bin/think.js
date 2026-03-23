#!/usr/bin/env node

import { main } from '../src/cli.js';

async function run() {
  const exitCode = await main(process.argv, {
    stdout: process.stdout,
    stderr: process.stderr,
  });

  process.exit(exitCode);
}

run().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
