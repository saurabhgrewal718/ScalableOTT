'use strict';

const { QUEUES } = require('../infra/constants');

class HeartbeatWorker {
  constructor(queueManager, analyticsClient, watchRepo, logger) {
    this.QUEUE_NAME      = QUEUES.HEARTBEAT;
    this.queueManager    = queueManager;
    this.analyticsClient = analyticsClient;
    this.watchRepo       = watchRepo;
    this.logger          = logger;
  }

  start() {
    return this.queueManager.createWorker(
      this.QUEUE_NAME,
      this.process.bind(this),
      { concurrency: parseInt(process.env.HEARTBEAT_CONCURRENCY || '1', 10) }
    );
  }

  async process(job) {
    const { events } = job.data;

    this.logger.info({ count: events.length }, '[HeartbeatWorker] processing batch');

    await Promise.all(
      events.map((event) =>
        this.watchRepo.upsertWatchProgress({
          userId:         event.userId,
          contentId:      event.contentId,
          watchedSeconds: event.watchedSeconds,
          sessionId:      event.sessionId,
        })
      )
    );

    await this.analyticsClient.sendBatch(events);
  }
}

module.exports = HeartbeatWorker;
