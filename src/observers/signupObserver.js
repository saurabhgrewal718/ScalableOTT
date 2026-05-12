'use strict';

class SignupObserver {
  constructor(domainEvents, analyticsQueue, pushQueue, crmQueue) {
    this.domainEvents   = domainEvents;
    this.analyticsQueue = analyticsQueue;
    this.pushQueue      = pushQueue;
    this.crmQueue       = crmQueue;
  }

  listen() {
    this.domainEvents.on('user:signup', async (data) => {
      const { userId, email, name, deviceToken, platform = 'unknown' } = data;

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
          // Log a structured error for each failed enqueue so alerting
          // systems can detect partial failures. BullMQ retries are the
          // first line of defence — if we can't even enqueue, it means
          // Redis is unavailable and this needs immediate attention.
          console.error(
            `[SignupObserver] ❌ Failed to enqueue ${labels[i]} side-effect for user=${userId}:`,
            result.reason?.message
          );
        }
      });

      const succeeded = results.filter((r) => r.status === 'fulfilled').length;
      console.log(
        `[SignupObserver] ✅ ${succeeded}/${results.length} side-effects enqueued for user=${userId}`
      );
    });
  }
}

module.exports = SignupObserver;
