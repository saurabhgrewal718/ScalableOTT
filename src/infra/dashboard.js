'use strict';

const { createBullBoard } = require('@bull-board/api');
const { BullMQAdapter }   = require('@bull-board/api/bullMQAdapter');
const { ExpressAdapter }  = require('@bull-board/express');

/**
 * Sets up BullBoard to monitor all BullMQ queues.
 * @param {object} app - Express app
 * @param {object} queueManager - Instance of QueueManager
 */
function setupDashboard(app, queueManager) {
  const dashboardPath = process.env.DASHBOARD_PATH || '/admin/queues';
  
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath(dashboardPath);

  // Get queues from the injected manager
  const queues = queueManager.getAllQueues().map(q => new BullMQAdapter(q));

  const { addQueue, setQueues } = createBullBoard({
    queues,
    serverAdapter: serverAdapter,
  });

  const logger = require('./logger');
  app.use(dashboardPath, serverAdapter.getRouter());

  logger.info({ path: dashboardPath }, '[dashboard] BullBoard mounted');

  return { addQueue, setQueues };
}

module.exports = { setupDashboard };
