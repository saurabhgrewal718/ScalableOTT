'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class EmailClient {
  async send({ to, subject, template, data }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(80);
        console.log(`[EmailClient] → sent to=${to} subject="${subject}" template=${template}`);
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 400, label: 'EmailClient' }
    );
  }
}

module.exports = EmailClient;
