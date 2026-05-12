'use strict';

const { EVENTS } = require('../infra/constants');

class PurchaseObserver {
  constructor(domainEvents, pushQueue, emailQueue, revenueQueue, crmQueue) {
    this.domainEvents = domainEvents;
    this.pushQueue = pushQueue;
    this.emailQueue = emailQueue;
    this.revenueQueue = revenueQueue;
    this.crmQueue = crmQueue;
  }

  listen() {
    this.domainEvents.on(EVENTS.PURCHASE_COMPLETED, async (data) => {
      const { purchase, userId, planId, amount, currency, email, deviceToken } = data;

      console.log(`[PurchaseObserver] Handling side-effects for purchase=${purchase.id}`);

      const results = await Promise.allSettled([
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
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(
            `[PurchaseObserver] ❌ Failed to enqueue ${labels[i]} side-effect for purchaseId=${purchase.id}:`,
            result.reason?.message
          );
        }
      });
    });
  }
}

module.exports = PurchaseObserver;
