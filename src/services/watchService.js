'use strict';

class WatchService {
  /**
   * @param {object} watchRepo
   * @param {object} heartbeatBuffer
   */
  constructor(watchRepo, heartbeatBuffer) {
    this.watchRepo = watchRepo;
    this.heartbeatBuffer = heartbeatBuffer;
  }

  async trackProgress({ userId, contentId, watchedSeconds, sessionId }) {
    // High-Scale Strategy: 
    // Instead of writing to the DB on every heartbeat (5-10s), we use a 
    // Write-Behind buffer.
    const result = await this.heartbeatBuffer.record({ 
      userId, 
      contentId, 
      watchedSeconds, 
      sessionId 
    });

    if (result.status === 'discarded') {
      // We don't log every discard at 10M scale (too much noise), 
      // but we return it for the controller to decide.
      return { status: 'skipped', reason: 'Already recorded or stale progress' };
    }

    return { status: 'success' };
  }
}

module.exports = WatchService;
