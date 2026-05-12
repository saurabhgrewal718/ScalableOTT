'use strict';

class HeartbeatWorker {
  constructor(queueManager, analyticsClient, watchRepo) {
    this.QUEUE_NAME   = 'heartbeat_saver_queue';
    this.queueManager = queueManager;
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

    for (const event of events) {
      await this.watchRepo.upsertWatchProgress({
        userId:         event.userId, 
        contentId:      event.contentId, 
        watchedSeconds: event.watchedSeconds,
        sessionId:      event.sessionId
      });
    }

    await this.analyticsClient.sendBatch(events);
  }
}

module.exports = HeartbeatWorker;
