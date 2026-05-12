'use strict';
require('dotenv').config();

const express = require('express');
const container = require('./container');
const { errorHandler } = require('./middleware/errorHandler');

const app = express();
app.use(express.json());

// ── Routes ──────────────────────────────────────────────────────────────────
const { userController, purchaseController, watchController } = container;

app.post('/user/signup',       userController.validation,     userController.handleUserSignup.bind(userController));
app.post('/purchase/complete', purchaseController.validation, purchaseController.handleContentPurchase.bind(purchaseController));
app.post('/watch/event',       watchController.validation,    watchController.handleVideoWatched.bind(watchController));

app.get('/health', (_req, res) => {
  res.json({ 
    status: 'ok', 
    process: 'web',
    uptime: process.uptime(),
    memory: process.memoryUsage().heapUsed 
  });
});

app.use(errorHandler);

// ─── Startup ─────────────────────────────────────────────────────────────────

const PORT = process.env.PORT || 3000;
const server = app.listen(PORT, () => {
  console.log(`[WebProcess] server listening on port ${PORT}`);
  
  // Start observers and flusher
  container.startWeb();

  const { setupDashboard } = require('./infra/dashboard');
  setupDashboard(app, container.queueManager);
});

async function shutdown() {
  console.log('[WebProcess] shutting down...');
  server.close(async () => {
    await container.shutdown();
    process.exit(0);
  });
}

process.on('SIGTERM', async () => {
  console.log('[WebProcess] SIGTERM received.');
  await shutdown();
});
process.on('SIGINT', async () => {
  console.log('[WebProcess] SIGINT received.');
  await shutdown();
});

module.exports = app;
