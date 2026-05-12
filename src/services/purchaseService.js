'use strict';

const { EVENTS } = require('../infra/constants');

class PurchaseService {
  /**
   * @param {object} purchaseRepo
   * @param {object} domainEventQueue
   */
  constructor(purchaseRepo, domainEventQueue) {
    this.purchaseRepo = purchaseRepo;
    this.domainEventQueue = domainEventQueue;
  }

  async completePurchase({ userId, planId, amount, currency, email, deviceToken, idempotencyKey }) {
    // 1. Critical path: persist the purchase record with idempotency check.
    //    We use the idempotencyKey (if provided) to ensure we don't charge twice.
    const { purchase, isNew } = await this.purchaseRepo.savePurchase({ 
      userId, 
      planId, 
      amount, 
      idempotencyKey 
    });

    // 2. Only fan-out side-effects if this is a NEW purchase.
    if (isNew) {
      await this.domainEventQueue.add(EVENTS.PURCHASE_COMPLETED, {
        purchase,
        userId,
        planId,
        amount,
        currency,
        email,
        deviceToken,
      });
    } else {
      console.log(`[PurchaseService] Skipping side-effects for duplicate purchase=${purchase.id}`);
    }

    return purchase;
  }
}

module.exports = PurchaseService;
