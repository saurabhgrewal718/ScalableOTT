'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class PurchaseRepo {
  constructor() {
    this.db = new Map();
  }

  async savePurchase({ userId, planId, amount }) {
    await simulateDbLatency(15);
    const record = { 
      id: `${userId}-${planId}-${Date.now()}`,
      userId, 
      planId, 
      amount, 
      createdAt: new Date().toISOString() 
    };
    this.db.set(record.id, record);
    console.log(`[PurchaseRepo] saved purchase id=${record.id}`);
    return record;
  }
}

module.exports = PurchaseRepo;
