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

    // 2. Enqueue all side-effect notifications concurrently.
    //    IMPORTANT: we use Promise.allSettled, NOT Promise.all.
    //    The purchase is already committed to the DB above. A transient
    //    Redis blip that fails one queue must NEVER cause this function to
    //    throw — that would return a 500 to the customer even though their
    //    payment went through, which could trigger a double-charge retry.
    //    Each failure is logged individually for ops visibility; BullMQ
    //    retries are the recovery mechanism, not the caller's error path.
    const sideEffects = await Promise.allSettled([
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

    const labels = ['push', 'email', 'revenue', 'crm'];
    sideEffects.forEach((result, i) => {
      if (result.status === 'rejected') {
        console.error(
          `[PurchaseService] ❌ Failed to enqueue ${labels[i]} side-effect for purchaseId=${purchase.id}:`,
          result.reason?.message
        );
      }
    });

    return purchase;
  }
}

module.exports = PurchaseService;
