'use strict';

class UserService {
  /**
   * @param {object} userRepo     - Repo for user DB operations.
   * @param {object} domainEvents - Central EventEmitter for decoupled side-effects.
   */
  constructor(userRepo, domainEvents) {
    this.userRepo = userRepo;
    this.domainEvents = domainEvents;
  }

  async signupUser(data) {
    // 1. Critical path: persist the user record. This MUST succeed before
    //    we announce anything.
    const user = await this.userRepo.saveUser(data);

    // 2. Emit the domain event fire-and-forget. The SignupObserver handles
    //    all async side-effects (analytics, push, CRM) without blocking
    //    the HTTP response to the caller.
    //    We emit `user` (the saved DB record), NOT `data` (the raw input).
    //    The persisted entity may differ from the input (e.g. createdAt,
    //    normalised fields) — observers must always receive the source of truth.
    this.domainEvents.emit('user:signup', user);

    return user;
  }
}

module.exports = UserService;
