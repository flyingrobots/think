/**
 * Capture followthrough budget.
 *
 * Capture is a trapdoor: the raw thought is committed first, and derived
 * graph work runs afterwards. That derived work is bounded so a slow or cold
 * repository cannot hold a capture call open. When the budget elapses the
 * followthrough is abandoned (not cancelled) and the caller reports a
 * deferred outcome — the raw thought is already safe.
 *
 * Both the CLI and MCP capture surfaces share this module so the budget and
 * the deferral semantics cannot drift apart between them.
 */

export const DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS = 6_000;

/**
 * The largest delay `setTimeout` can hold.
 *
 * Node stores the delay in a 32-bit signed integer and substitutes 1ms for
 * anything larger, with a TimeoutOverflowWarning. Left unclamped, asking for a
 * very large budget would produce immediate deferral — the opposite of intent —
 * so an over-range request is clamped to the maximum rather than defaulted,
 * which honours the direction the operator asked for.
 */
export const MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS = 2_147_483_647;

export const CAPTURE_FOLLOWTHROUGH_DEFERRED = Object.freeze({ status: 'deferred' });

/**
 * Resolve the followthrough budget from the environment.
 *
 * An unusable value falls back to the default rather than throwing: capture
 * must not fail because of a malformed knob.
 */
export function resolveCaptureFollowthroughTimeoutMs(environment = process.env) {
  const raw = String(environment.THINK_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS ?? '').trim();
  if (raw === '' || !/^\d+$/u.test(raw)) {
    return DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    return DEFAULT_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS;
  }

  return Math.min(parsed, MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS);
}

/**
 * One budget shared across sequential followthrough waits.
 *
 * The CLI awaits twice — the graph-model probe, then the finalize. Handing each
 * await the full budget let a slow capture spend up to twice what the operator
 * configured. A deadline makes the budget mean total elapsed time, which is what
 * "capture must not hang" actually requires.
 */
export function createCaptureFollowthroughDeadline(budgetMs, now = Date.now) {
  const startedAt = now();
  const clamped = Math.min(budgetMs, MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS);

  return Object.freeze({
    budgetMs: clamped,
    remainingMs: () => Math.max(0, clamped - (now() - startedAt)),
    expired: () => now() - startedAt >= clamped,
  });
}

export function isDeferredCaptureFollowthrough(followthrough) {
  return followthrough?.status === CAPTURE_FOLLOWTHROUGH_DEFERRED.status;
}

/**
 * Race a followthrough promise against the budget.
 *
 * Rejections propagate so callers can report the underlying failure. Callers
 * that keep the abandoned promise alive must attach their own catch handler.
 */
export async function waitForCaptureFollowthrough(followthroughPromise, { timeoutMs } = {}) {
  const budgetMs = Math.min(
    timeoutMs ?? resolveCaptureFollowthroughTimeoutMs(),
    MAX_CAPTURE_FOLLOWTHROUGH_TIMEOUT_MS
  );

  // A spent budget has nothing left to grant. Racing setTimeout(0) instead let an
  // already-settled followthrough win the race, so work slipped through a budget
  // the caller had already exhausted.
  if (budgetMs <= 0) {
    return CAPTURE_FOLLOWTHROUGH_DEFERRED;
  }

  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    // Deliberately not unref'd. An unref'd timer does not hold the event loop, so
    // a process with nothing else pending exits instead of deferring and the
    // budget stops being a guarantee. clearTimeout below already ensures the
    // timer never outlives the race, so there is nothing left for unref to buy.
    timeoutId = setTimeout(() => resolve(CAPTURE_FOLLOWTHROUGH_DEFERRED), budgetMs);
  });

  try {
    return await Promise.race([followthroughPromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}
