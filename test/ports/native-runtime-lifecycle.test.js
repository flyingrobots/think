import assert from 'node:assert/strict';
import test from 'node:test';

import { main } from '../../src/cli.js';
import { createThinkMcpServer } from '../../src/mcp/server.js';
import * as nativeRuntime from '../../src/store/native-runtime.js';

test('native memory sessions close their git-warp Runtime exactly once', async () => {
  let closeCalls = 0;
  const runtime = {
    close() {
      closeCalls += 1;
      return Promise.resolve();
    },
  };
  const session = new nativeRuntime.NativeMemorySession(
    '/tmp/think-native-runtime-lifecycle',
    'test-writer',
    runtime,
    {}
  );

  await Promise.all([
    session.close(),
    session.close(),
    session[Symbol.asyncDispose](),
  ]);

  assert.equal(closeCalls, 1);
});

test('native runtime adapter exposes an owned process-level teardown', () => {
  assert.equal(typeof nativeRuntime.closeAllNativeMemory, 'function');
});

test('CLI invocation closes its native runtime scope', async () => {
  let closeCalls = 0;
  const stream = { write() {} };

  const exitCode = await main(['node', 'think', '--help'], {
    closeRuntime() {
      closeCalls += 1;
      return Promise.resolve();
    },
    stderr: stream,
    stdin: { isTTY: true },
    stdout: stream,
  });

  assert.equal(exitCode, 0);
  assert.equal(closeCalls, 1);
});

test('MCP server closes its native runtime scope', async () => {
  let closeCalls = 0;
  const server = createThinkMcpServer({
    closeRuntime() {
      closeCalls += 1;
      return Promise.resolve();
    },
  });

  await server.close();

  assert.equal(closeCalls, 1);
});
