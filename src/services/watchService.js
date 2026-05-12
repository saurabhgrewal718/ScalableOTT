'use strict';

class WatchService {
  constructor(watchRepo, heartbeatBuffer) {
    this.watchRepo       = watchRepo;
    this.heartbeatBuffer = heartbeatBuffer;
  }

  async trackProgress({ userId, contentId, watchedSeconds, sessionId }) {
    // Write-behind pattern: buffer the heartbeat in Redis only.
    // The HeartbeatWorker drains the buffer on a periodic flush interval
    // and persists to the DB in bulk — this is the entire point of the
    // buffer. Writing directly to the DB here as well would double the
    // write load and defeat the purpose of the pattern.
    await this.heartbeatBuffer.record({ userId, contentId, watchedSeconds, sessionId });

    return { status: 'buffered' };
  }
}

module.exports = WatchService;
