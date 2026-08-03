import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CAPTURE_FOLLOWTHROUGH_DEFERRED,
  createCaptureFollowthroughDeadline,
  DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS,
  isDeferredCaptureFollowthrough,
  MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS,
  resolveCaptureFollowthroughTimeoutMs,
  waitForCaptureFollowthrough,
} from '../../src/capture-followthrough.js';

test('the default capture followthrough budget stays at the documented 6 seconds', () => {
  assert.equal(DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS, 6_000);
  assert.equal(resolveCaptureFollowthroughTimeoutMs({}), 6_000);
  assert.equal(resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '' }), 6_000);
  assert.equal(resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '   ' }), 6_000);
});

test('operators can raise the followthrough budget for slow or cold repositories', () => {
  assert.equal(
    resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '60000' }),
    60_000
  );
  assert.equal(
    resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: ' 250 ' }),
    250
  );
});

test('an unusable followthrough budget falls back to the default instead of breaking the capture trapdoor', () => {
  for (const raw of ['0', '-1', 'soon', '12.5', 'NaN', 'Infinity', '1e3']) {
    assert.equal(
      resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: raw }),
      DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS,
      `Expected "${raw}" to fall back to the default followthrough budget.`
    );
  }
});

test('a budget beyond the 32-bit timer range is clamped, not silently turned into 1ms', () => {
  // setTimeout stores its delay in a 32-bit signed integer. Node warns and
  // substitutes 1ms for anything larger, so an operator asking for a very large
  // budget would get immediate deferral — the exact opposite of the request.
  assert.equal(
    resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '2147483648' }),
    MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS
  );
  assert.equal(
    resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '99999999999' }),
    MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS
  );
});

test('the largest in-range budget is preserved exactly', () => {
  assert.equal(MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS, 2_147_483_647);
  assert.equal(
    resolveCaptureFollowthroughTimeoutMs({ THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS: '2147483647' }),
    2_147_483_647
  );
});

test('waitForCaptureFollowthrough clamps an over-range budget it is handed directly', async () => {
  // The exported helper must not overflow either, since callers can pass a
  // budget without going through the resolver.
  const settled = await waitForCaptureFollowthrough(Promise.resolve({ migration: null }), {
    timeoutMs: Number.MAX_SAFE_INTEGER,
  });

  assert.deepEqual(settled, { migration: null }, 'Expected no immediate deferral from an over-range budget.');
});

test('waitForCaptureFollowthrough returns the settled followthrough when it beats the budget', async () => {
  const result = await waitForCaptureFollowthrough(Promise.resolve({ migration: null }), {
    timeoutMs: 10_000,
  });

  assert.deepEqual(result, { migration: null });
  assert.equal(isDeferredCaptureFollowthrough(result), false);
});

test('waitForCaptureFollowthrough defers once the budget elapses', async () => {
  const neverSettles = new Promise(() => {});

  const result = await waitForCaptureFollowthrough(neverSettles, { timeoutMs: 1 });

  assert.equal(result, CAPTURE_FOLLOWTHROUGH_DEFERRED);
  assert.equal(isDeferredCaptureFollowthrough(result), true);
});

test('waitForCaptureFollowthrough propagates followthrough rejections to the caller', async () => {
  await assert.rejects(
    waitForCaptureFollowthrough(Promise.reject(new Error('graph write failed')), { timeoutMs: 10_000 }),
    /graph write failed/
  );
});

test('a followthrough deadline spends one budget across sequential waits', () => {
  // The CLI awaits twice: the graph-model probe, then the finalize. Handing each
  // the full budget lets a slow capture spend up to 2x what the operator
  // configured, so the budget has to be a shared deadline rather than a
  // per-await allowance.
  const clock = { now: 1_000 };
  const deadline = createCaptureFollowthroughDeadline(500, () => clock.now);

  assert.equal(deadline.remainingMs(), 500);

  clock.now = 1_200;
  assert.equal(deadline.remainingMs(), 300, 'Expected elapsed time to be deducted.');

  clock.now = 1_500;
  assert.equal(deadline.remainingMs(), 0, 'Expected an exhausted deadline to report zero.');

  clock.now = 9_999;
  assert.equal(deadline.remainingMs(), 0, 'Expected an overrun deadline never to go negative.');
});

test('an exhausted deadline reports itself as expired', () => {
  const clock = { now: 0 };
  const deadline = createCaptureFollowthroughDeadline(100, () => clock.now);

  assert.equal(deadline.expired(), false);
  clock.now = 100;
  assert.equal(deadline.expired(), true);
});

test('isDeferredCaptureFollowthrough matches the sentinel by status, not identity', () => {
  assert.equal(isDeferredCaptureFollowthrough({ status: 'deferred' }), true);
  assert.equal(isDeferredCaptureFollowthrough({ status: 'done' }), false);
  assert.equal(isDeferredCaptureFollowthrough({ migration: null }), false);
  assert.equal(isDeferredCaptureFollowthrough(null), false);
  assert.equal(isDeferredCaptureFollowthrough(undefined), false);
});

test('the deferred sentinel is frozen so surfaces cannot mutate shared capture state', () => {
  assert.equal(Object.isFrozen(CAPTURE_FOLLOWTHROUGH_DEFERRED), true);
  assert.equal(CAPTURE_FOLLOWTHROUGH_DEFERRED.status, 'deferred');
});
