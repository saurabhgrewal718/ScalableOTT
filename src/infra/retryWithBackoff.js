'use strict';

/**
 * src/infra/retryWithBackoff.js
 *
 * Retries an async function with full-jitter exponential backoff.
 *
 * Delay formula (per attempt i, 1-indexed):
 *   base = baseDelayMs * factor^(i-1)
 *   jitter = random(0, base * 0.3)       ← prevents thundering-herd
 *   actual delay = Math.min(base + jitter, maxDelayMs)
 *
 * @param {() => Promise<any>} fn           - The async operation to retry.
 * @param {object}  [opts]
 * @param {number}  [opts.maxAttempts=3]    - Total attempts before throwing.
 * @param {number}  [opts.baseDelayMs=200]  - Initial backoff delay in ms.
 * @param {number}  [opts.factor=2]         - Backoff multiplier.
 * @param {boolean} [opts.jitter=true]      - Add random jitter.
 * @param {number}  [opts.maxDelayMs=10000] - Cap on any single delay.
 * @param {string}  [opts.label='op']       - Label for log messages.
 * @returns {Promise<any>}
 */
async function retryWithBackoff(fn, {
  maxAttempts = 3,
  baseDelayMs = 2000,
  factor = 2,
  jitter = true,
  maxDelayMs = 10000,
  label = 'op',
} = {}) {
  let lastError;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err;

      if (attempt === maxAttempts) break;

      const base = baseDelayMs * Math.pow(factor, attempt - 1);
      const jitterMs = jitter ? Math.random() * base * 0.5 : 0;
      const delay = Math.min(Math.round(base + jitterMs), maxDelayMs);

      console.warn(
        `[retryWithBackoff:${label}] attempt ${attempt}/${maxAttempts} failed: "${err.message}". ` +
        `Retrying in ${delay}ms…`
      );

      await sleep(delay);
    }
  }

  // Annotate with attempt count before re-throwing
  lastError.retryAttempts = maxAttempts;
  throw lastError;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

module.exports = { retryWithBackoff };
