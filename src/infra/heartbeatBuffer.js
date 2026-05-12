'use strict';

const { QUEUES } = require('./constants');

class HeartbeatBuffer {
  /**
   * @param {object} redis - Redis instance
   * @param {object} queueManager - Instance of QueueManager
   */
  constructor(redis, queueManager, logger) {
    this.CIRCUIT_RESET_MS = parseInt(process.env.HEARTBEAT_CIRCUIT_RESET_MS || '60000', 10);
    this.FLUSH_INTERVAL_MS = parseInt(process.env.HEARTBEAT_FLUSH_INTERVAL_MS || '10000', 10);
    this.REDIS_KEY = 'heartbeat_buffer';
    this.QUEUE_NAME = QUEUES.HEARTBEAT;

    this.redis = redis;
    this.queueManager = queueManager;
    this.logger = logger;

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
      this.logger.error({ err: err.message }, '[HeartbeatBuffer] failed to write to Redis');
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
      this.logger.info({ count: snapshot.length }, '[HeartbeatBuffer] flushing heartbeats to queue');

      const saveQueue = this.queueManager.createQueue(this.QUEUE_NAME);
      await saveQueue.add('process_batch', { events: snapshot });

      this.circuitOpen = false;
    } catch (err) {
      this.logger.error({ err: err.message }, '[HeartbeatBuffer] flush failed — opening circuit');
      this.circuitOpen = true;
      setTimeout(() => {
        this.logger.info('[HeartbeatBuffer] circuit RESET');
        this.circuitOpen = false;
      }, this.CIRCUIT_RESET_MS);
    } finally {
      this.isFlushing = false;
    }
  }

  startFlusher() {
    if (this.flushTimer) return;
    
    // Applying Jitter to prevent "Thundering Herd" spikes
    const jitter = Math.random() * 2000;
    this.flushTimer = setInterval(() => this.flush(), this.FLUSH_INTERVAL_MS + jitter);
    
    this.logger.info({ interval: this.FLUSH_INTERVAL_MS, jitter }, '[HeartbeatBuffer] jittered flusher started');
  }

  async stopFlusher() {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
    await this.flush();
  }
}

module.exports = HeartbeatBuffer;
