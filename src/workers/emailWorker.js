'use strict';

const { QUEUES } = require('../infra/constants');

class EmailWorker {
  constructor(queueManager, emailClient) {
    this.QUEUE_NAME = QUEUES.EMAIL;
    this.queueManager = queueManager;
    this.emailClient = emailClient;
  }

  start() {
    return this.queueManager.createWorker(this.QUEUE_NAME, this.process.bind(this));
  }

  async process(job) {
    const { to, subject, template, data } = job.data;
    await this.emailClient.send({ to, subject, template, data });
  }
}

module.exports = EmailWorker;
