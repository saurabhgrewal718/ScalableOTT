'use strict';

const { EVENTS } = require('../infra/constants');

class SignupObserver {
  /**
   * @param {object} domainEvents
   * @param {object} analyticsQueue
   * @param {object} pushQueue
   * @param {object} crmQueue
   */
  constructor(domainEvents, analyticsQueue, pushQueue, crmQueue) {
    this.domainEvents   = domainEvents;
    this.analyticsQueue = analyticsQueue;
    this.pushQueue      = pushQueue;
    this.crmQueue       = crmQueue;
  }

  listen() {
    this.domainEvents.on(EVENTS.USER_SIGNUP, async (user) => {
      const { userId, email, name, deviceToken, platform = 'unknown' } = user;

      console.log(`[SignupObserver] Handling side-effects for user=${userId}`);

      // Enqueue all side-effects concurrently — none depend on each other.
      // Promise.allSettled is used deliberately: a single queue failure (e.g.
      // a transient CRM blip) must NOT silence the others. Each failure is
      // logged individually so on-call has full visibility.
      const results = await Promise.allSettled([
        this.analyticsQueue.add('user_signup', { userId, event: 'signup', platform }),
        this.pushQueue.add('welcome_push', {
          userId,
          token: deviceToken,
          title: `Welcome ${name}!`,
          body: 'Thanks for joining our streaming platform.',
        }),
        this.crmQueue.add('create_contact', {
          email,
          name,
          source: 'app_signup',
        }),
      ]);

      const labels = ['analytics', 'push', 'crm'];
      results.forEach((result, i) => {
        if (result.status === 'rejected') {
          console.error(
            `[SignupObserver] ❌ Failed to enqueue ${labels[i]} side-effect for user=${userId}:`,
            result.reason?.message
          );
        }
      });
    });
  }
}

module.exports = SignupObserver;
