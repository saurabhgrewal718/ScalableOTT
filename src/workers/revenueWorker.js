'use strict';

class RevenueWorker {
  constructor(queueManager, revenueClient) {
    this.QUEUE_NAME = 'revenue_events';
    this.queueManager = queueManager;
    this.revenueClient = revenueClient;
  }

  start() {
    return this.queueManager.createWorker(this.QUEUE_NAME, this.process.bind(this));
  }

  async process(job) {
    const { userId, amount, currency, event } = job.data;
    await this.revenueClient.capture({ userId, amount, currency, event });
  }
}

module.exports = RevenueWorker;
