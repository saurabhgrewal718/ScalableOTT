'use strict';

class WatchService {
  constructor(watchRepo, heartbeatBuffer) {
    this.watchRepo = watchRepo;
    this.heartbeatBuffer = heartbeatBuffer;
  }

  async trackProgress({ userId, contentId, watchedSeconds, sessionId }) {
    // 1. Instant update in DB (Aggregated later)
    await this.watchRepo.upsertWatchProgress({ userId, contentId, watchedSeconds, sessionId });

    // 2. Add to Write-Behind Buffer (High-Scale)
    await this.heartbeatBuffer.record({ userId, contentId, watchedSeconds, sessionId });

    return { status: 'buffered' };
  }
}

module.exports = WatchService;
