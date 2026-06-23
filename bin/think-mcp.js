#!/usr/bin/env node

import { serveStdio } from '../src/mcp/server.js';

serveStdio().catch((error) => {
  const message = error instanceof Error ? error.stack || error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exit(1);
});
