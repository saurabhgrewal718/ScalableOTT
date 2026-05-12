'use strict';

const { QUEUES } = require('../infra/constants');

class CrmWorker {
  constructor(queueManager, crmClient) {
    this.CONTACT_QUEUE  = QUEUES.CRM_CONTACTS;
    this.CAMPAIGN_QUEUE = QUEUES.CRM_CAMPAIGNS;
    this.queueManager   = queueManager;
    this.crmClient      = crmClient;
  }

  start() {
    const contactWorker = this.queueManager.createWorker(this.CONTACT_QUEUE,  this.processContact.bind(this));
    const campaignWorker = this.queueManager.createWorker(this.CAMPAIGN_QUEUE, this.processCampaign.bind(this));
    
    console.log('[CrmWorker] started all CRM listeners');
    
    return [contactWorker, campaignWorker];
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
