'use strict';

class PurchaseService {
  constructor(purchaseRepo, pushQueue, emailQueue, revenueQueue, crmQueue) {
    this.purchaseRepo = purchaseRepo;
    this.pushQueue = pushQueue;
    this.emailQueue = emailQueue;
    this.revenueQueue = revenueQueue;
    this.crmQueue = crmQueue;
  }

  async completePurchase({ userId, planId, amount, currency, email, deviceToken }) {
    // 1. Save to DB (Critical Path)
    const purchase = await this.purchaseRepo.savePurchase({ userId, planId, amount });

    // 2. Enqueue side-effects with DYNAMIC data, not using observer pattern here
    await this.pushQueue.add('purchase_push', {
      userId,
      token: deviceToken,
      title: 'Purchase Successful!',
      body: `You are now subscribed to ${planId}`
    });

    await this.emailQueue.add('purchase_email', {
      to: email,
      subject: 'Your subscription is active',
      template: 'purchase_confirmation',
      data: { planId, amount, currency }
    });

    await this.revenueQueue.add('capture_revenue', {
      userId,
      amount,
      currency,
      event: 'subscription_purchase'
    });

    await this.crmQueue.add('trigger_campaign', {
      userId,
      campaignId: 'premium_onboarding'
    });

    return purchase;
  }
}

module.exports = PurchaseService;
