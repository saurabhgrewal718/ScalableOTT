'use strict';

const { simulateDbLatency } = require('../utils/simulation');

class PurchaseRepo {
  constructor(logger) {
    this.logger = logger;
    this.db = new Map();
  }

  /**
   * Saves a purchase with idempotency.
   */
  async savePurchase({ userId, planId, amount, idempotencyKey }) {
    await simulateDbLatency(15);
    
    if (idempotencyKey && this.db.has(idempotencyKey)) {
      this.logger.info({ idempotencyKey }, '[PurchaseRepo] idempotency hit');
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
    this.logger.info({ id, userId }, '[PurchaseRepo] saved new purchase');
    
    return { purchase: record, isNew: true };
  }
}

module.exports = PurchaseRepo;
