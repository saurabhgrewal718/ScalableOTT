'use strict';

class PurchaseService {
  constructor(purchaseRepo, pushQueue, emailQueue, revenueQueue, crmQueue) {
    this.purchaseRepo = purchaseRepo;
    this.pushQueue    = pushQueue;
    this.emailQueue   = emailQueue;
    this.revenueQueue = revenueQueue;
    this.crmQueue     = crmQueue;
  }

  async completePurchase({ userId, planId, amount, currency, email, deviceToken }) {
    // 1. Critical path: persist the purchase record first.
    const purchase = await this.purchaseRepo.savePurchase({ userId, planId, amount });

    // 2. Fire all independent side-effect queues concurrently.
    //    These have zero ordering dependency between them — awaiting
    //    them sequentially would multiply latency for no reason.
    await Promise.all([
      this.pushQueue.add('purchase_push', {
        userId,
        token: deviceToken,
        title: 'Purchase Successful!',
        body: `You are now subscribed to ${planId}`,
      }),
      this.emailQueue.add('purchase_email', {
        to: email,
        subject: 'Your subscription is active',
        template: 'purchase_confirmation',
        data: { planId, amount, currency },
      }),
      this.revenueQueue.add('capture_revenue', {
        userId,
        amount,
        currency,
        event: 'subscription_purchase',
      }),
      this.crmQueue.add('trigger_campaign', {
        userId,
        campaignId: 'premium_onboarding',
      }),
    ]);

    return purchase;
  }
}

module.exports = PurchaseService;
