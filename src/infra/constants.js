'use strict';

/**
 * src/infra/constants.js
 *
 * Single source of truth for all system-wide constants.
 */

module.exports = Object.freeze({
  QUEUES: {
    ANALYTICS: 'analytics_events',
    PUSH:      'push_notifications',
    CRM_CONTACTS:  'crm_contacts',
    CRM_CAMPAIGNS: 'crm_campaigns',
    EMAIL:     'emails',
    REVENUE:   'revenue_events',
    HEARTBEAT: 'heartbeat_saver_queue',
    DOMAIN_EVENTS: 'domain_events_bus',
  },
  EVENTS: {
    USER_SIGNUP: 'user:signup',
    PURCHASE_COMPLETED: 'purchase:completed',
  },
});
