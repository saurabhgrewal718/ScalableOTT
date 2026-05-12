'use strict';

const { QUEUES } = require('./infra/constants');

/**
 * AppContainer (Dependency Injection Container)
 * 
 * Centralizes the creation and lifecycle of all services, repos, and controllers.
 * Uses lazy-loading to ensure components are only created when needed.
 */
class AppContainer {
  constructor() {
    this._instances = new Map();
  }

  // --- Infrastructure (Lazy) ---
  get logger() {
    return this._get('logger', () => require('./infra/logger'));
  }

  get redis() {
    return this._get('redis', () => {
      const { sharedRedis } = require('./infra/redis');
      return sharedRedis;
    });
  }

  get queueManager() {
    return this._get('queueManager', () => {
      const { redisConfig } = require('./infra/redis');
      const QueueManager = require('./infra/queue');
      return new QueueManager(redisConfig, this.logger);
    });
  }

  get heartbeatBuffer() {
    return this._get('heartbeatBuffer', () => {
      const HeartbeatBuffer = require('./infra/heartbeatBuffer');
      return new HeartbeatBuffer(this.redis, this.queueManager, this.logger);
    });
  }

  // --- Repositories (Lazy) ---
  get userRepo() { return this._get('userRepo', () => new (require('./repositories/userRepo'))(this.logger)); }
  get purchaseRepo() { return this._get('purchaseRepo', () => new (require('./repositories/purchaseRepo'))(this.logger)); }
  get watchRepo() { return this._get('watchRepo', () => new (require('./repositories/watchRepo'))(this.logger)); }

  // --- Clients (Lazy) ---
  get analyticsClient() { return this._get('analyticsClient', () => new (require('./clients/analyticsClient'))(this.logger)); }
  get pushClient() { return this._get('pushClient', () => new (require('./clients/pushClient'))(this.logger)); }
  get emailClient() { return this._get('emailClient', () => new (require('./clients/emailClient'))(this.logger)); }
  get crmClient() { return this._get('crmClient', () => new (require('./clients/crmClient'))(this.logger)); }
  get revenueClient() { return this._get('revenueClient', () => new (require('./clients/revenueClient'))(this.logger)); }

  // --- Queues (Lazy) ---
  get queues() {
    return this._get('queues', () => ({
      analytics: this.queueManager.createQueue(QUEUES.ANALYTICS),
      push:      this.queueManager.createQueue(QUEUES.PUSH),
      crm:       this.queueManager.createQueue(QUEUES.CRM_CONTACTS),
      email:     this.queueManager.createQueue(QUEUES.EMAIL),
      revenue:   this.queueManager.createQueue(QUEUES.REVENUE),
      campaigns: this.queueManager.createQueue(QUEUES.CRM_CAMPAIGNS),
      heartbeat: this.queueManager.createQueue(QUEUES.HEARTBEAT),
      eventsBus: this.queueManager.createQueue(QUEUES.DOMAIN_EVENTS),
    }));
  }

  // --- Services (Lazy) ---
  get userService() {
    return this._get('userService', () => {
      const UserService = require('./services/userService');
      return new UserService(this.userRepo, this.queues.eventsBus, this.logger);
    });
  }

  get purchaseService() {
    return this._get('purchaseService', () => {
      const PurchaseService = require('./services/purchaseService');
      return new PurchaseService(this.purchaseRepo, this.queues.eventsBus, this.logger);
    });
  }

  get watchService() {
    return this._get('watchService', () => {
      const WatchService = require('./services/watchService');
      return new WatchService(this.watchRepo, this.heartbeatBuffer, this.logger);
    });
  }

  // --- Feature Groups ---
  getControllers() {
    return {
      userController:     this._get('userController',     () => new (require('./controllers/userController'))(this.userService)),
      purchaseController: this._get('purchaseController', () => new (require('./controllers/purchaseController'))(this.purchaseService)),
      watchController:    this._get('watchController',    () => new (require('./controllers/watchController'))(this.watchService)),
    };
  }

  getDashboard() {
    return this._get('dashboard', () => {
      const { createBullBoard } = require('@bull-board/api');
      const { BullMQAdapter } = require('@bull-board/api/bullMQAdapter');
      const { ExpressAdapter } = require('@bull-board/express');

      const serverAdapter = new ExpressAdapter();
      serverAdapter.setBasePath('/admin/queues');

      const queues = Object.values(this.queues).map(q => new BullMQAdapter(q));
      createBullBoard({ queues, serverAdapter });

      return { serverAdapter };
    });
  }

  // --- Workers (Lazy) ---
  get workers() {
    return this._get('workers', () => {
      const NotificationWorker = require('./workers/notificationWorker');
      const AnalyticsWorker = require('./workers/analyticsWorker');
      const EmailWorker = require('./workers/emailWorker');
      const CrmWorker = require('./workers/crmWorker');
      const RevenueWorker = require('./workers/revenueWorker');
      const HeartbeatWorker = require('./workers/heartbeatWorker');
      const DomainEventWorker = require('./workers/domainEventWorker');

      return [
        new NotificationWorker(this.queueManager, this.pushClient, this.logger),
        new AnalyticsWorker(this.queueManager, this.analyticsClient, this.logger),
        new EmailWorker(this.queueManager, this.emailClient, this.logger),
        new CrmWorker(this.queueManager, this.crmClient, this.logger),
        new RevenueWorker(this.queueManager, this.revenueClient, this.logger),
        new HeartbeatWorker(this.queueManager, this.analyticsClient, this.watchRepo, this.logger),
        new DomainEventWorker(
          this.queueManager,
          this.queues.analytics,
          this.queues.push,
          this.queues.crm,
          this.queues.email,
          this.queues.revenue,
          this.queues.campaigns,
          this.logger
        ),
      ];
    });
  }

  _get(key, factory) {
    if (!this._instances.has(key)) {
      this._instances.set(key, factory());
    }
    return this._instances.get(key);
  }

  startWeb() {
    this.heartbeatBuffer.startFlusher();
    this.logger.info('[AppContainer] web-side components started');
  }

  startWorker() {
    this.workers.forEach(w => w.start());
    this.logger.info('[AppContainer] worker-side components started');
  }

  async dispose() {
    this.logger.info('[AppContainer] performing graceful shutdown...');
    if (this._instances.has('heartbeatBuffer')) await this.heartbeatBuffer.stopFlusher();
    if (this._instances.has('queueManager')) await this.queueManager.closeAll();
    if (this._instances.has('redis')) await this.redis.quit();
  }
}

module.exports = { AppContainer };
