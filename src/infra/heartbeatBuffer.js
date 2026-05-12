'use strict';

class HeartbeatBuffer {
  /**
   * @param {object} redis - Redis instance
   * @param {object} queueManager - Instance of QueueManager
   */
  constructor(redis, queueManager) {
    this.CIRCUIT_RESET_MS = parseInt(process.env.HEARTBEAT_CIRCUIT_RESET_MS || '60000', 10);
    this.FLUSH_INTERVAL_MS = parseInt(process.env.HEARTBEAT_FLUSH_INTERVAL_MS || '10000', 10);
    this.REDIS_KEY = 'heartbeat_buffer';

    this.redis = redis;
    this.queueManager = queueManager;

    this.flushTimer = null;
    this.isFlushing = false;
    this.circuitOpen = false;
  }

  async record(event) {
    try {
      await this.redis.hset(this.REDIS_KEY, event.sessionId, JSON.stringify({
        ...event,
        timestamp: Date.now()
      }));
    } catch (err) {
      console.error('[HeartbeatBuffer] Failed to write to Redis:', err.message);
    }
  }

  async flush() {
    if (this.isFlushing || this.circuitOpen) return;

    this.isFlushing = true;
    try {
      const data = await this.redis.hgetall(this.REDIS_KEY);
      if (!data || Object.keys(data).length === 0) {
        this.isFlushing = false;
        return;
      }

      await this.redis.del(this.REDIS_KEY);

      const snapshot = Object.values(data).map(v => JSON.parse(v));
      console.log(`[HeartbeatBuffer] Flushing ${snapshot.length} heartbeats to worker queue`);

      // Using the INJECTED queue manager
      const saveQueue = this.queueManager.createQueue('heartbeat_saver_queue');
      await saveQueue.add('process_batch', { events: snapshot });

      this.circuitOpen = false;
    } catch (err) {
      console.error('[HeartbeatBuffer] Flush failed — opening circuit:', err.message);
      this.circuitOpen = true;
      setTimeout(() => {
        console.log('[HeartbeatBuffer] circuit RESET');
        this.circuitOpen = false;
      }, this.CIRCUIT_RESET_MS);
    } finally {
      this.isFlushing = false;
    }
  }

  startFlusher() {
    if (this.flushTimer) return;
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS);
    console.log(`[HeartbeatBuffer] Redis-backed flusher started (interval=${this.FLUSH_INTERVAL_MS}ms)`);
  }

  async stopFlusher() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }

  async getBufferSize() {
    try {
      return await this.redis.hlen(this.REDIS_KEY);
    } catch (err) {
      return 0;
    }
  }
}

module.exports = HeartbeatBuffer;
