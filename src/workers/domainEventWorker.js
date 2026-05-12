'use strict';

const { QUEUES, EVENTS } = require('../infra/constants');

/**
 * DomainEventWorker
 * 
 * This is the "Engine" of our Event-Driven Architecture.
 * It consumes events from the 'domain_events_bus' and fans them out
 * to specific side-effect queues.
 * 
 * WHY: This replaces the in-memory EventEmitter. By moving the "Observer" 
 * logic into a background worker, we ensure that side-effects are never 
 * lost if the web server restarts.
 */
class DomainEventWorker {
  constructor(queueManager, analyticsQueue, pushQueue, crmQueue, emailQueue, revenueQueue, campaignQueue) {
    this.QUEUE_NAME = QUEUES.DOMAIN_EVENTS;
    this.queueManager = queueManager;
    
    // Sub-queues for fan-out
    this.analyticsQueue = analyticsQueue;
    this.pushQueue = pushQueue;
    this.crmQueue = crmQueue;
    this.emailQueue = emailQueue;
    this.revenueQueue = revenueQueue;
    this.campaignQueue = campaignQueue;
  }

  start() {
    this.queueManager.createWorker(this.QUEUE_NAME, this.process.bind(this));
    console.log(`[DomainEventWorker] Listening on ${this.QUEUE_NAME}...`);
  }

  async process(job) {
    const { name, data } = job;

    switch (name) {
      case EVENTS.USER_SIGNUP:
        await this.handleUserSignup(data);
        break;
      
      case EVENTS.PURCHASE_COMPLETED:
        await this.handlePurchaseCompleted(data);
        break;

      default:
        console.warn(`[DomainEventWorker] Unknown event type: ${name}`);
    }
  }

  async handleUserSignup(user) {
    const { userId, email, name, deviceToken, platform = 'unknown' } = user;
    console.log(`[DomainEventWorker] Fanning out side-effects for signup: ${userId}`);

    await Promise.allSettled([
      this.analyticsQueue.add('user_signup', { userId, event: 'signup', platform }),
      this.pushQueue.add('welcome_push', {
        userId,
        token: deviceToken,
        title: `Welcome ${name}!`,
        body: 'Thanks for joining our streaming platform.',
      }),
      this.crmQueue.add('create_contact', {
        email,
        name,
        source: 'app_signup',
      }),
    ]);
  }

  async handlePurchaseCompleted(data) {
    const { purchase, userId, planId, amount, currency, email, deviceToken } = data;
    console.log(`[DomainEventWorker] Fanning out side-effects for purchase: ${purchase.id}`);

    await Promise.allSettled([
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
      this.campaignQueue.add('trigger_campaign', {
        userId,
        campaignId: 'premium_onboarding',
      }),
    ]);
  }
}

module.exports = DomainEventWorker;
