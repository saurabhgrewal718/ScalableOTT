'use strict';
require('dotenv').config();

const container = require('./container');

/**
 * Entry point for the background worker process.
 * Wrapped in an async main() so startup errors surface as
 * explicit failures rather than silent unhandled rejections.
 */
async function main() {
  console.log('[WorkerProcess] Starting all background workers...');
  await container.startWorker();
  console.log('[WorkerProcess] Workers are now listening for jobs.');
}

main().catch((err) => {
  console.error('[WorkerProcess] Fatal startup error:', err);
  process.exit(1);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────

let isShuttingDown = false;
async function shutdown() {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log('[WorkerProcess] shutting down...');
  await container.shutdown();
  process.exit(0);
}

process.on('SIGTERM', async () => {
  console.log('[WorkerProcess] SIGTERM received.');
  await shutdown();
});
process.on('SIGINT', async () => {
  console.log('[WorkerProcess] SIGINT received.');
  await shutdown();
});
