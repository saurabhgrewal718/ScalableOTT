'use strict';

class CrmWorker {
  constructor(queueManager, crmClient) {
    this.CONTACT_QUEUE  = 'crm_contacts';
    this.CAMPAIGN_QUEUE = 'crm_campaigns';
    this.queueManager   = queueManager;
    this.crmClient      = crmClient;
  }

  start() {
    this.queueManager.createWorker(this.CONTACT_QUEUE,  this.processContact.bind(this));
    this.queueManager.createWorker(this.CAMPAIGN_QUEUE, this.processCampaign.bind(this));
    console.log('[CrmWorker] started all CRM listeners');
  }

  async processContact(job) {
    const { email, name, source } = job.data;
    await this.crmClient.createContact({ email, name, source });
  }

  async processCampaign(job) {
    const { userId, campaignId } = job.data;
    await this.crmClient.triggerCampaign({ userId, campaignId });
  }
}

module.exports = CrmWorker;
