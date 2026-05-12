'use strict';

const { Queue, Worker } = require('bullmq');

class QueueManager {
  /**
   * @param {object} connection - Shared Redis connection object
   */
  constructor(connection) {
    this.connection = connection;
    this.queues     = new Map();
    this.workers    = [];
    this.jobHistory = [];
  }

  createQueue(name) {
    if (this.queues.has(name)) return this.queues.get(name);

    const q = new Queue(name, { 
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 1000, // 1s, 2s, 4s...
        },
        removeOnComplete: {
          count: 100, // Keep last 100 successful jobs for visibility
          age: 24 * 3600, // Or keep for 24 hours
        },
        removeOnFail: {
          count: 500, // Keep more failed jobs for debugging
        }
      }
    });
    
    const originalAdd = q.add.bind(q);
    q.add = async (jobName, data, opts) => {
      this.jobHistory.push({ queue: name, jobName, data, timestamp: new Date() });
      if (this.jobHistory.length > 100) this.jobHistory.shift(); 
      return originalAdd(jobName, data, opts);
    };

    this.queues.set(name, q);
    return q;
  }

  createWorker(name, processor, opts = {}) {
    const w = new Worker(name, processor, {
      connection: this.connection,
      ...opts,
    });

    w.on('completed', (job) => console.log(`[Worker:${name}] job ${job.id} completed`));
    w.on('failed', (job, err) => console.error(`[Worker:${name}] job ${job.id} failed: ${err.message}`));

    this.workers.push(w);
    return w;
  }

  getAllQueues() {
    return Array.from(this.queues.values());
  }

  async closeAll() {
    await Promise.all(this.workers.map(w => w.close()));
    await Promise.all(Array.from(this.queues.values()).map(q => q.close()));
    console.log('[QueueManager] all connections closed');
  }
}

module.exports = QueueManager; // Export CLASS, not instance
