'use strict';

const { QUEUES } = require('./infra/constants');

class AppContainer {
  constructor() {
    this._instances = new Map();
  }

  // --- Infrastructure (Lazy) ---
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
      return new QueueManager(redisConfig);
    });
  }

  get heartbeatBuffer() {
    return this._get('heartbeatBuffer', () => {
      const HeartbeatBuffer = require('./infra/heartbeatBuffer');
      return new HeartbeatBuffer(this.redis, this.queueManager);
    });
  }

  // --- Repositories (Lazy) ---
  get userRepo() { return this._get('userRepo', () => new (require('./repositories/userRepo'))()); }
  get purchaseRepo() { return this._get('purchaseRepo', () => new (require('./repositories/purchaseRepo'))()); }
  get watchRepo() { return this._get('watchRepo', () => new (require('./repositories/watchRepo'))()); }

  // --- Clients (Lazy) ---
  get analyticsClient() { return this._get('analyticsClient', () => new (require('./clients/analyticsClient'))()); }
  get pushClient() { return this._get('pushClient', () => new (require('./clients/pushClient'))()); }
  get emailClient() { return this._get('emailClient', () => new (require('./clients/emailClient'))()); }
  get crmClient() { return this._get('crmClient', () => new (require('./clients/crmClient'))()); }
  get revenueClient() { return this._get('revenueClient', () => new (require('./clients/revenueClient'))()); }

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
      // Persistent handoff: injecting queue instead of EventEmitter
      return new UserService(this.userRepo, this.queues.eventsBus);
    });
  }

  get purchaseService() {
    return this._get('purchaseService', () => {
      const PurchaseService = require('./services/purchaseService');
      // Persistent handoff: injecting queue instead of EventEmitter
      return new PurchaseService(this.purchaseRepo, this.queues.eventsBus);
    });
  }

  get watchService() {
    return this._get('watchService', () => {
      const WatchService = require('./services/watchService');
      return new WatchService(this.watchRepo, this.heartbeatBuffer);
    });
  }

  // --- Controllers (Lazy) ---
  get userController() {
    return this._get('userController', () => {
      const UserController = require('./controllers/userController');
      const { userSignupSchema } = require('./validators/userValidator');
      const { validate } = require('./middleware/validate');
      return new UserController(this.userService, validate(userSignupSchema));
    });
  }

  get purchaseController() {
    return this._get('purchaseController', () => {
      const PurchaseController = require('./controllers/purchaseController');
      const { purchaseSchema } = require('./validators/purchaseValidator');
      const { validate } = require('./middleware/validate');
      return new PurchaseController(this.purchaseService, validate(purchaseSchema));
    });
  }

  get watchController() {
    return this._get('watchController', () => {
      const WatchController = require('./controllers/watchController');
      const { watchEventSchema } = require('./validators/watchValidator');
      const { validate } = require('./middleware/validate');
      return new WatchController(this.watchService, validate(watchEventSchema));
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
        new NotificationWorker(this.queueManager, this.pushClient),
        new AnalyticsWorker(this.queueManager, this.analyticsClient),
        new EmailWorker(this.queueManager, this.emailClient),
        new CrmWorker(this.queueManager, this.crmClient),
        new RevenueWorker(this.queueManager, this.revenueClient),
        new HeartbeatWorker(this.queueManager, this.analyticsClient, this.watchRepo),
        new DomainEventWorker(
          this.queueManager,
          this.queues.analytics,
          this.queues.push,
          this.queues.crm,
          this.queues.email,
          this.queues.revenue,
          this.queues.campaigns
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

  /**
   * Start web-side dependencies.
   */
  startWeb() {
    this.heartbeatBuffer.startFlusher();
    console.log('[AppContainer] Web-side components started (Flusher)');
  }

  /**
   * Start background workers.
   */
  startWorker() {
    this.workers.forEach(w => w.start());
    console.log('[AppContainer] Worker-side components started (BullMQ Workers)');
  }

  async shutdown() {
    console.log('[AppContainer] performing graceful shutdown...');
    if (this._instances.has('heartbeatBuffer')) await this.heartbeatBuffer.stopFlusher();
    if (this._instances.has('queueManager')) await this.queueManager.closeAll();
    if (this._instances.has('redis')) await this.redis.quit();
  }
}

module.exports = new AppContainer();
