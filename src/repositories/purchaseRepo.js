'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class PurchaseRepo {
  constructor() {
    this.db = new Map();
  }

  /**
   * Saves a purchase with idempotency.
   * In a real system, the idempotencyKey would come from the client/header.
   */
  async savePurchase({ userId, planId, amount, idempotencyKey }) {
    await simulateDbLatency(15);
    
    // If an idempotencyKey is provided, check if we've already handled it
    if (idempotencyKey && this.db.has(idempotencyKey)) {
      console.log(`[PurchaseRepo] Idempotency Hit: purchase key=${idempotencyKey} already exists.`);
      return { purchase: this.db.get(idempotencyKey), isNew: false };
    }

    const id = idempotencyKey || `${userId}-${planId}-${Date.now()}`;
    const record = { 
      id,
      userId, 
      planId, 
      amount, 
      createdAt: new Date().toISOString() 
    };
    
    this.db.set(id, record);
    console.log(`[PurchaseRepo] saved new purchase id=${id}`);
    
    return { purchase: record, isNew: true };
  }
}

module.exports = PurchaseRepo;
