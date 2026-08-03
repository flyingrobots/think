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

  return parsed;
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
  const budgetMs = timeoutMs ?? resolveCaptureFollowthroughTimeoutMs();
  let timeoutId = null;
  const timeout = new Promise((resolve) => {
    timeoutId = setTimeout(() => resolve(CAPTURE_FOLLOWTHROUGH_DEFERRED), budgetMs);
    timeoutId.unref?.();
  });

  try {
    return await Promise.race([followthroughPromise, timeout]);
  } finally {
    clearTimeout(timeoutId);
  }
}
