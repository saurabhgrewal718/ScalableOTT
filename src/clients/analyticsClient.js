'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class AnalyticsClient {
  async sendEvent(event) {
    return retryWithBackoff(
      async () => {
        if (event.userId === 'fail_user') {
          console.error(`[AnalyticsClient] !! SIMULATING CRASH !! for event="${event.event}"`);
          throw new Error('Analytics API is down (Simulated Chaos)');
        }
        await simulateNetwork(20);
        console.log(`[AnalyticsClient] → event="${event.event}" userId=${event.userId}`);
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
        console.log(`[AnalyticsClient] → batch of ${events.length} events sent`);
        return { success: true, count: events.length };
      },
      { maxAttempts: 3, baseDelayMs: 2000, label: 'analytics.sendBatch' }
    );
  }
}

module.exports = AnalyticsClient;
