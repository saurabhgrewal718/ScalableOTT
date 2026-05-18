'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class UserRepo {
  constructor(logger) {
    this.logger = logger;
    this.db = new Map();
    this.idempotencyMap = new Map();
  }

  /**
   * Saves a user with idempotency.
   */
  async saveUser({ userId, email, name, platform, deviceToken, idempotencyKey }) {
    await simulateDbLatency(10);
    
    if (idempotencyKey && this.idempotencyMap.has(idempotencyKey)) {
      const existingUserId = this.idempotencyMap.get(idempotencyKey);
      this.logger.info({ idempotencyKey }, '[UserRepo] idempotency hit (key)');
      return { user: this.db.get(existingUserId), isNew: false };
    }

    if (this.db.has(userId)) {
      this.logger.info({ userId }, '[UserRepo] idempotency hit (userId)');
      return { user: this.db.get(userId), isNew: false };
    }

    const record = { 
      userId, 
      email, 
      name, 
      platform: platform || 'unknown',
      deviceToken: deviceToken || null,
      createdAt: new Date().toISOString() 
    };
    
    this.db.set(userId, record);
    
    if (idempotencyKey) {
      this.idempotencyMap.set(idempotencyKey, userId);
    }

    this.logger.info({ userId, hasDeviceToken: !!deviceToken }, '[UserRepo] saved new user');
    return { user: record, isNew: true };
  }

  async findUserById(userId) {
    await simulateDbLatency(5);
    return this.db.get(userId) || null;
  }
}

module.exports = UserRepo;
