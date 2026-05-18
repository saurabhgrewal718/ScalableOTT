'use strict';

const { QUEUES } = require('../infra/constants');

class RevenueWorker {
  constructor(queueManager, revenueClient, logger) {
    this.QUEUE_NAME = QUEUES.REVENUE;
    this.queueManager = queueManager;
    this.revenueClient = revenueClient;
    this.logger = logger;
    
    // Moved to environment for "Twelve-Factor" compliance
    this.JOB_TIMEOUT_MS = parseInt(process.env.REVENUE_JOB_TIMEOUT_MS || '15000', 10);
    this.CONCURRENCY = parseInt(process.env.REVENUE_CONCURRENCY || '2', 10);
  }

  start() {
    return this.queueManager.createWorker(
      this.QUEUE_NAME, 
      this.process.bind(this),
      { concurrency: this.CONCURRENCY }
    );
  }

  async process(job) {
    const { userId, amount, currency, event, idempotencyKey } = job.data;

    const timeout = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('REVENUE_GATEWAY_TIMEOUT')), this.JOB_TIMEOUT_MS)
    );

    try {
      await Promise.race([
        this.revenueClient.capture({ 
          userId, 
          amount, 
          currency, 
          event, 
          idempotencyKey 
        }),
        timeout
      ]);
    } catch (err) {
      if (err.message === 'REVENUE_GATEWAY_TIMEOUT') {
        this.logger.error({ userId, timeoutMs: this.JOB_TIMEOUT_MS }, '[RevenueWorker] gateway timeout');
      }
      throw err;
    }
  }
}

module.exports = RevenueWorker;
