'use strict';

class UserService {
  /**
   * @param {object} userRepo - repo for the user db operations
   * @param {object} domainEvents - The EventEmitter for decoupled logic
   */
  constructor(userRepo, domainEvents) {
    this.userRepo = userRepo;
    this.domainEvents = domainEvents;
  }

  async signupUser(data) {
    // 1. Critical DB Write (The core responsibility)
    const user = await this.userRepo.saveUser(data);

    // 2. Announce the event (The decoupled responsibility) we are not wiating for its response, 
    // we have just emmited the event and now we are sending a confirmation to the user 
    // without blocking the usser
    this.domainEvents.emit('user:signup', data);

    return user;
  }
}

module.exports = UserService;
