'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class AnalyticsClient {
  constructor(logger) {
    this.logger = logger;
  }

  async sendEvent(event) {
    return retryWithBackoff(
      async () => {
        if (event.userId === 'fail_user') {
          this.logger.error({ eventName: event.event }, '[AnalyticsClient] !! SIMULATING CRASH !!');
          throw new Error('Analytics API is down (Simulated Chaos)');
        }
        await simulateNetwork(20);
        this.logger.info({ eventName: event.event, userId: event.userId }, '[AnalyticsClient] → event sent');
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 2000, label: 'analytics.sendEvent' }
    );
  }

  async sendBatch(events) {
    if (!events || events.length === 0) return;

    return retryWithBackoff(
      async () => {
        await simulateNetwork(50);
        this.logger.info({ count: events.length }, '[AnalyticsClient] → batch sent');
        return { success: true, count: events.length };
      },
      { maxAttempts: 3, baseDelayMs: 2000, label: 'analytics.sendBatch' }
    );
  }
}

module.exports = AnalyticsClient;
