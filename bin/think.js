#!/usr/bin/env node

import { main } from '../src/cli.js';

const exitCode = await main(process.argv, {
  stdout: process.stdout,
  stderr: process.stderr,
});

process.exit(exitCode);
