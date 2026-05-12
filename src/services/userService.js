'use strict';

const { EVENTS } = require('../infra/constants');

class UserService {
  /**
   * @param {object} userRepo
   * @param {object} domainEventQueue
   */
  constructor(userRepo, domainEventQueue) {
    this.userRepo = userRepo;
    this.domainEventQueue = domainEventQueue;
  }

  async signupUser(data) {
    // 1. Critical path: persist the user record with an idempotency check.
    const { user, isNew } = await this.userRepo.saveUser(data);

    // 2. Only emit the domain event if this is a NEW registration.
    //    This prevents duplicate side-effects (emails, analytics) if the
    //    client retries the request.
    if (isNew) {
      await this.domainEventQueue.add(EVENTS.USER_SIGNUP, user);
    } else {
      console.log(`[UserService] Skipping domain event for existing user=${user.userId}`);
    }

    return user;
  }
}

module.exports = UserService;
