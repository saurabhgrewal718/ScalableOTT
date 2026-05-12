'use strict';

const { QUEUES } = require('../infra/constants');

class HeartbeatWorker {
  constructor(queueManager, analyticsClient, watchRepo) {
    this.QUEUE_NAME      = QUEUES.HEARTBEAT;
    this.queueManager    = queueManager;
    this.analyticsClient = analyticsClient;
    this.watchRepo       = watchRepo;
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

    console.log(`[HeartbeatWorker] Processing batch of ${events.length} heartbeats`);

    // Persist all heartbeat records concurrently — they are fully independent
    // of each other. A for-await loop would serialize them and multiply latency
    // by the batch size with zero benefit.
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
