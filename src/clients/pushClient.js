'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class PushClient {
  constructor(logger) {
    this.logger = logger;
  }

  async send({ userId, token, title, body }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(35);
        this.logger.info({ token, title }, '[PushClient] → push sent');
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 300, label: 'PushClient' }
    );
  }
}

module.exports = PushClient;
