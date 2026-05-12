'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class RevenueClient {
  constructor(logger) {
    this.logger = logger;
  }

  async capture({ userId, amount, currency, event }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(120);
        this.logger.info({ userId, amount, currency, eventName: event }, '[RevenueClient] → revenue captured');
        return { success: true };
      },
      { maxAttempts: 5, baseDelayMs: 200, label: 'RevenueClient' }
    );
  }
}

module.exports = RevenueClient;
