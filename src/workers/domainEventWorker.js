'use strict';

const { QUEUES, EVENTS } = require('../infra/constants');

/**
 * DomainEventWorker
 * 
 * This is the "Engine" of our Event-Driven Architecture.
 */
class DomainEventWorker {
  constructor(queueManager, analyticsQueue, pushQueue, crmQueue, emailQueue, revenueQueue, campaignQueue, logger) {
    this.QUEUE_NAME = QUEUES.DOMAIN_EVENTS;
    this.queueManager = queueManager;
    this.logger = logger;
    
    // Sub-queues for fan-out
    this.analyticsQueue = analyticsQueue;
    this.pushQueue = pushQueue;
    this.crmQueue = crmQueue;
    this.emailQueue = emailQueue;
    this.revenueQueue = revenueQueue;
    this.campaignQueue = campaignQueue;

    // Configurable via .env
    this.CONCURRENCY = parseInt(process.env.DOMAIN_EVENTS_CONCURRENCY || '10', 10);
  }

  start() {
    this.queueManager.createWorker(
      this.QUEUE_NAME, 
      this.process.bind(this),
      { concurrency: this.CONCURRENCY }
    );
    this.logger.info({ queue: this.QUEUE_NAME, concurrency: this.CONCURRENCY }, '[DomainEventWorker] listening');
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
        this.logger.warn({ eventName: name }, '[DomainEventWorker] unknown event type');
    }
  }

  async handleUserSignup(user) {
    const { userId, email, name, deviceToken, platform = 'unknown' } = user;
    this.logger.info({ userId }, '[DomainEventWorker] fanning out side-effects for signup');

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
    const { purchase, userId, planId, amount, currency, email, deviceToken, idempotencyKey } = data;
    this.logger.info({ purchaseId: purchase.id, userId }, '[DomainEventWorker] fanning out side-effects for purchase');

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
        idempotencyKey,
      }),
      this.campaignQueue.add('trigger_campaign', {
        userId,
        campaignId: 'premium_onboarding',
      }),
    ]);
  }
}

module.exports = DomainEventWorker;
