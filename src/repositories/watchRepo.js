'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class WatchRepo {
  constructor() {
    this.db = new Map();
  }

  async upsertWatchProgress({ userId, contentId, watchedSeconds, sessionId }) {
    await simulateDbLatency(6);
    const key     = `${userId}:${contentId}`;
    const existing = this.db.get(key) || {};
    this.db.set(key, {
      ...existing,
      userId,
      contentId,
      watchedSeconds,
      sessionId,
      updatedAt: new Date().toISOString(),
    });
    console.log(`[WatchRepo] upsert user=${userId} content=${contentId} seconds=${watchedSeconds}`);
  }
}

module.exports = WatchRepo;
