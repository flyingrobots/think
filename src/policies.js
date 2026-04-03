import { Policy } from '@git-stunts/alfred';

const PUSH_TIMEOUT_MS = 1500;
const PUSH_RETRIES = 1;
const PUSH_RETRY_DELAY_MS = 100;

const CAPTURE_TIMEOUT_MS = 10_000;

/**
 * Upstream backup push: timeout per attempt, then retry once with
 * exponential backoff and full jitter. Transient network failures
 * and timeouts are retried; persistent errors are not.
 */
export function createPushPolicy({ shouldRetry, onTimeout, onRetry } = {}) {
  return Policy.timeout(PUSH_TIMEOUT_MS, { onTimeout })
    .wrap(Policy.retry({
      retries: PUSH_RETRIES,
      delay: PUSH_RETRY_DELAY_MS,
      backoff: 'exponential',
      jitter: 'full',
      shouldRetry,
      onRetry,
    }));
}

/**
 * MCP capture service: timeout around the full WARP graph write +
 * finalization path so a hung store operation doesn't block forever.
 */
export const capturePolicy = Policy.timeout(CAPTURE_TIMEOUT_MS);
