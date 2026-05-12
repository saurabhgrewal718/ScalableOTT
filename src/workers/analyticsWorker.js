'use strict';

class AnalyticsWorker {
  /**
   * @param {object} queueManager
   * @param {object} analyticsClient
   */
  constructor(queueManager, analyticsClient) {
    this.QUEUE_NAME = 'analytics_events';
    this.queueManager = queueManager;
    this.analyticsClient = analyticsClient;
  }

  start() {
    return this.queueManager.createWorker(
      this.QUEUE_NAME,
      this.process.bind(this),
      { concurrency: parseInt(process.env.ANALYTICS_CONCURRENCY || '20', 10) }
    );
  }

  async process(job) {
    await this.analyticsClient.sendEvent(job.data);
  }
}

module.exports = AnalyticsWorker;
