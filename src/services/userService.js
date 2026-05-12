'use strict';

class UserService {
  /**
   * @param {object} userRepo     - Repo for user DB operations.
   * @param {object} domainEvents - Central EventEmitter for decoupled side-effects.
   */
  constructor(userRepo, domainEvents) {
    this.userRepo     = userRepo;
    this.domainEvents = domainEvents;
  }

  async signupUser(data) {
    // 1. Critical path: persist the user record. This MUST succeed before
    //    we announce anything.
    const user = await this.userRepo.saveUser(data);

    // 2. Emit the domain event fire-and-forget. The SignupObserver handles
    //    all async side-effects (analytics, push, CRM) without blocking
    //    the HTTP response to the caller.
    this.domainEvents.emit('user:signup', data);

    return user;
  }
}

module.exports = UserService;
