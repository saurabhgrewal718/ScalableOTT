'use strict';

const { retryWithBackoff }  = require('../infra/retryWithBackoff');
const { simulateNetwork } = require('../utils/simulation');

class CrmClient {
  async createContact({ email, name, source }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(60);
        console.log(`[CrmClient] → contact created email=${email} source=${source}`);
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 500, label: 'crm.createContact' }
    );
  }

  async triggerCampaign({ userId, campaignId }) {
    return retryWithBackoff(
      async () => {
        await simulateNetwork(45);
        console.log(`[CrmClient] → campaign triggered userId=${userId} campaignId=${campaignId}`);
        return { success: true };
      },
      { maxAttempts: 3, baseDelayMs: 500, label: 'crm.triggerCampaign' }
    );
  }
}

module.exports = CrmClient;
