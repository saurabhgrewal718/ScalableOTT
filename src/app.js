'use strict';

require('dotenv').config();
const express = require('express');
const { AppContainer } = require('./container');
const { errorHandler } = require('./middleware/errorHandler');

/**
 * Staff-Level Modular API
 * All routing is handled internally by Controllers via 'BaseController'
 */
function startWeb() {
  const app = express();
  const container = new AppContainer();
  const logger = container.logger;

  // 1. Global Middleware
  app.use(express.json());

  // 2. Health & Monitoring
  const { serverAdapter } = container.getDashboard();
  app.use('/admin/queues', serverAdapter.getRouter());
  
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime(), process: 'web' });
  });

  // 3. Feature Mounting (The "Clean" Manifest)
  const { userController, purchaseController, watchController } = container.getControllers();
  
  app.use('/user',     userController.router);
  app.use('/purchase', purchaseController.router);
  app.use('/watch',    watchController.router);

  // 4. Global Error Handling
  app.use(errorHandler);

  // 5. Lifecyle Management
  const PORT = process.env.PORT || 3000;
  const server = app.listen(PORT, () => {
    logger.info({ port: PORT }, '[WebProcess] server listening');
    container.startWeb(); 
  });

  // 6. Graceful Shutdown (Idempotent)
  let isShuttingDown = false;
  const shutdown = async (signal) => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    
    logger.info({ signal }, '[WebProcess] shutdown initiated');
    server.close(async () => {
      await container.dispose();
      process.exit(0);
    });
  };

  process.on('SIGINT',  () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

if (require.main === module) {
  startWeb();
}

module.exports = { startWeb };
