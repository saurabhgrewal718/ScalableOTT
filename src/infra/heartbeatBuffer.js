'use strict';

const { QUEUES } = require('./constants');

/**
 * HeartbeatBuffer
 * 
 * A high-throughput "Write-Behind" cache.
 * Instead of hitting the DB on every heartbeat (every 5-10s), we buffer 
 * events in a Redis list and flush them in bulk to the DB.
 */
class HeartbeatBuffer {
  /**
   * @param {object} redis - ioredis instance
   * @param {object} queueManager
   */
  constructor(redis, queueManager) {
    this.redis = redis;
    this.queueManager = queueManager;
    this.BUFFER_KEY = 'heartbeat_buffer';
    this.LAST_POS_PREFIX = 'watch:last:';
    this.flushInterval = null;
    
    // Atomic Lua script to ensure "Monotonicity" (watchedSeconds must only increase)
    // Returns 1 if updated, 0 if rejected as duplicate/stale.
    this.LUA_MONOTONIC_CHECK = `
      local key = KEYS[1]
      local newVal = tonumber(ARGV[1])
      local currentVal = tonumber(redis.call('GET', key) or '-1')
      
      if newVal > currentVal then
        redis.call('SET', key, newVal, 'EX', 3600) -- 1h TTL
        return 1
      else
        return 0
      end
    `;
  }

  /**
   * Records a heartbeat with "Monotonicity Filtering".
   */
  async record(event) {
    const { sessionId, watchedSeconds } = event;
    const lastPosKey = `${this.LAST_POS_PREFIX}${sessionId}`;

    try {
      // 1. Atomic Check: Only proceed if this value is GREATER than the last one we saw.
      const isNew = await this.redis.eval(
        this.LUA_MONOTONIC_CHECK, 
        1, 
        lastPosKey, 
        watchedSeconds
      );

      if (!isNew) {
        // Discarding duplicate/stale heartbeat to save Redis memory & DB throughput
        return { status: 'discarded', reason: 'non-monotonic' };
      }

      // 2. Add the unique, advancing heartbeat to the Write-Behind buffer
      await this.redis.lpush(this.BUFFER_KEY, JSON.stringify(event));
      return { status: 'buffered' };

    } catch (err) {
      console.error('[HeartbeatBuffer] Error recording heartbeat:', err);
      // Fallback: at 10M scale, if Redis is failing, we might want to log/drop
      throw err;
    }
  }

  /**
   * Flushes the buffer into the background worker queue.
   */
  async flush() {
    const len = await this.redis.llen(this.BUFFER_KEY);
    if (len === 0) return;

    console.log(`[HeartbeatBuffer] Flushing ${len} events to worker queue...`);

    // Use a temporary key to atomically pop all items
    const tempKey = `heartbeat_flush:${Date.now()}`;
    await this.redis.rename(this.BUFFER_KEY, tempKey);

    const items = await this.redis.lrange(tempKey, 0, -1);
    await this.redis.del(tempKey);

    // Push to BullMQ for the HeartbeatWorker to process in bulk
    const heartbeatQueue = this.queueManager.createQueue(QUEUES.HEARTBEAT);
    await heartbeatQueue.add('bulk_heartbeat_flush', {
      events: items.map(i => JSON.parse(i)),
      timestamp: new Date().toISOString()
    });
  }

  startFlusher(intervalMs = 10000) {
    if (this.flushInterval) return;
    this.flushInterval = setInterval(() => this.flush(), intervalMs);
    console.log(`[HeartbeatBuffer] Redis-backed flusher started (interval=${intervalMs}ms)`);
  }

  async stopFlusher() {
    if (this.flushInterval) {
      clearInterval(this.flushInterval);
      this.flushInterval = null;
      await this.flush(); // Final flush
    }
  }
}

module.exports = HeartbeatBuffer;
