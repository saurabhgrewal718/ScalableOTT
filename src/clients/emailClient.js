'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class EmailClient {
  constructor(logger) {
    this.logger = logger;
  }

  async send({ to, subject, template, data }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(80);
        this.logger.info({ to, subject, template }, '[EmailClient] → email sent');
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 400, label: 'EmailClient' }
    );
  }
}

module.exports = EmailClient;
