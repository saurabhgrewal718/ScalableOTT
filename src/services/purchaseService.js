'use strict';

const { EVENTS } = require('../infra/constants');

class PurchaseService {
  /**
   * @param {object} purchaseRepo
   * @param {object} domainEvents
   */
  constructor(purchaseRepo, domainEvents) {
    this.purchaseRepo = purchaseRepo;
    this.domainEvents = domainEvents;
  }

  async completePurchase({ userId, planId, amount, currency, email, deviceToken }) {
    // 1. Critical path: persist the purchase record first.
    const purchase = await this.purchaseRepo.savePurchase({ userId, planId, amount });

    // 2. Emit domain event. Side-effects (Push, Email, Revenue, CRM) are now
    //    decoupled and handled by PurchaseObserver.
    this.domainEvents.emit(EVENTS.PURCHASE_COMPLETED, {
      purchase,
      userId,
      planId,
      amount,
      currency,
      email,
      deviceToken,
    });

    return purchase;
  }
}

module.exports = PurchaseService;
