'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class PushClient {
  async send({ userId, token, title, body }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(35);
        console.log(`[PushClient] → push sent token=${token} title="${title}"`);
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 300, label: 'PushClient' }
    );
  }
}

module.exports = PushClient;
