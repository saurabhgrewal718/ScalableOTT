'use strict';
require('dotenv').config();

const container = require('./container');

console.log('[WorkerProcess] Starting all background workers...');

// Start the workers via the container
container.startWorker();

console.log('[WorkerProcess] Workers are now listening for jobs.');

// Graceful Shutdown for Worker Process
async function shutdown() {
  console.log('[WorkerProcess] shutting down...');
  await container.shutdown();
  process.exit(0);
}

process.on('SIGTERM', async () => {
  console.log('[WorkerProcess] SIGTERM received. Closing...');
  await shutdown();
});
process.on('SIGINT', async () => {
  console.log('[WorkerProcess] SIGINT received. Closing...');
  await shutdown();
});
