'use strict';

class NotificationWorker {
  constructor(queueManager, pushClient) {
    this.QUEUE_NAME = 'push_notifications';
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
