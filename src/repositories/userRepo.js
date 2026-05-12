'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class UserRepo {
  constructor() {
    this.db = new Map();
  }

  async saveUser({ userId, email, name }) {
    await simulateDbLatency(10);
    const record = { userId, email, name, createdAt: new Date().toISOString() };
    this.db.set(userId, record);
    console.log(`[UserRepo] saved user=${userId}`);
    return record;
  }

  async findUserById(userId) {
    await simulateDbLatency(5);
    return this.db.get(userId) || null;
  }
}

module.exports = UserRepo;
