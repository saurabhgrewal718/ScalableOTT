'use strict';

const { EVENTS } = require('../infra/constants');

class UserService {
  /**
   * @param {object} userRepo
   * @param {object} domainEventQueue
   * @param {object} logger
   */
  constructor(userRepo, domainEventQueue, logger) {
    this.userRepo = userRepo;
    this.domainEventQueue = domainEventQueue;
    this.logger = logger;
  }

  async signupUser(data) {
    // 1. Critical path: persist the user record with idempotency check.
    const { user, isNew } = await this.userRepo.saveUser(data);

    // 2. Only emit the domain event if this is a NEW registration.
    if (isNew) {
      await this.domainEventQueue.add(EVENTS.USER_SIGNUP, user);
    } else {
      this.logger.info({ userId: user.userId }, '[UserService] skipping domain event for existing user');
    }

    return user;
  }
}

module.exports = UserService;
