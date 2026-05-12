'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class RevenueClient {
  async capture({ userId, amount, currency, event }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(120);
        console.log(`[RevenueClient] → captured ${currency} ${amount} userId=${userId} event=${event}`);
        return { success: true };
      },
      { maxAttempts: 5, baseDelayMs: 200, label: 'RevenueClient' }
    );
  }
}

module.exports = RevenueClient;
