'use strict';

const { EVENTS } = require('../infra/constants');

class PurchaseService {
  /**
   * @param {object} purchaseRepo
   * @param {object} domainEventQueue
   * @param {object} logger
   */
  constructor(purchaseRepo, domainEventQueue, logger) {
    this.purchaseRepo = purchaseRepo;
    this.domainEventQueue = domainEventQueue;
    this.logger = logger;
  }

  async completePurchase({ userId, planId, amount, currency, email, deviceToken, idempotencyKey }) {
    // 1. Critical path: persist the purchase record with idempotency check.
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
      this.logger.info({ purchaseId: purchase.id }, '[PurchaseService] skipping side-effects for duplicate purchase');
    }

    return purchase;
  }
}

module.exports = PurchaseService;
