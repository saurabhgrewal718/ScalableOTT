'use strict';

const { QUEUES } = require('../infra/constants');

class RevenueWorker {
  constructor(queueManager, revenueClient) {
    this.QUEUE_NAME = QUEUES.REVENUE;
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
