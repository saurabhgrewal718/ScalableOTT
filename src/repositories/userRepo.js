'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class UserRepo {
  constructor() {
    this.db = new Map();
  }

  /**
   * Saves a user if they don't exist.
   * Returns { user, isNew }
   */
  async saveUser({ userId, email, name }) {
    await simulateDbLatency(10);
    
    // Check for existence (Idempotency check)
    if (this.db.has(userId)) {
      console.log(`[UserRepo] Idempotency Hit: user=${userId} already exists.`);
      return { user: this.db.get(userId), isNew: false };
    }

    const record = { userId, email, name, createdAt: new Date().toISOString() };
    this.db.set(userId, record);
    console.log(`[UserRepo] saved new user=${userId}`);
    
    return { user: record, isNew: true };
  }

  async findUserById(userId) {
    await simulateDbLatency(5);
    return this.db.get(userId) || null;
  }
}

module.exports = UserRepo;
