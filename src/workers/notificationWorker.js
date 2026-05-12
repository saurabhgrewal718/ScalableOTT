'use strict';

const { QUEUES } = require('../infra/constants');

class NotificationWorker {
  constructor(queueManager, pushClient) {
    this.QUEUE_NAME = QUEUES.PUSH;
    this.queueManager = queueManager;
    this.pushClient = pushClient;
  }

  start() {
    return this.queueManager.createWorker(this.QUEUE_NAME, this.process.bind(this));
  }

  async process(job) {
    const { userId, token, title, body } = job.data;
    await this.pushClient.send({ userId, token, title, body });
  }
}

module.exports = NotificationWorker;
