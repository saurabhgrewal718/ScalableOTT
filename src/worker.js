'use strict';

require('dotenv').config();
const { AppContainer } = require('./container');

/**
 * Staff-Level Worker Process
 */
async function startWorker() {
  const container = new AppContainer();
  const logger = container.logger;

  try {
    logger.info('[WorkerProcess] starting background workers...');
    container.startWorker();
    logger.info('[WorkerProcess] workers are now listening for jobs');
  } catch (err) {
    logger.error({ err }, '[WorkerProcess] fatal startup error');
    process.exit(1);
  }

  // Graceful Shutdown (Idempotent)
  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info({ signal }, '[WorkerProcess] shutdown initiated');
    await container.dispose();
    process.exit(0);
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  startWorker();
}

module.exports = { startWorker };
