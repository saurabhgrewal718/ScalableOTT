'use strict';

const { retryWithBackoff } = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class CrmClient {
  constructor(logger) {
    this.logger = logger;
  }

  async createContact({ email, name, source }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(60);
        this.logger.info({ email, source }, '[CrmClient] → contact created');
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 500, label: 'crm.createContact' }
    );
  }

  async triggerCampaign({ userId, campaignId }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(45);
        this.logger.info({ userId, campaignId }, '[CrmClient] → campaign triggered');
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 500, label: 'crm.triggerCampaign' }
    );
  }
}

module.exports = CrmClient;
