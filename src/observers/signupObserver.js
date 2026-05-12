'use strict';

class SignupObserver {
  constructor(domainEvents, analyticsQueue, pushQueue, crmQueue) {
    this.domainEvents = domainEvents;
    this.analyticsQueue = analyticsQueue;
    this.pushQueue = pushQueue;
    this.crmQueue = crmQueue;
  }

  listen() {
    this.domainEvents.on('user:signup', async (data) => {
      const { userId, email, name, deviceToken } = data;
      
      console.log(`[SignupObserver] Handling side-effects for user=${userId}`);

      try {
        await this.analyticsQueue.add('user_signup', { userId, event: 'signup', platform: 'ios' });
        
        await this.pushQueue.add('welcome_push', { 
          userId, 
          token: deviceToken, 
          title: `Welcome ${name}!`, 
          body: 'Thanks for joining our streaming platform.' 
        });

        await this.crmQueue.add('create_contact', { 
          email, 
          name, 
          source: 'app_signup' 
        });

        console.log(`[SignupObserver] ✅ SUCCESS: All side-effects enqueued for user=${userId}`);
      } catch (err) {
        console.error(`[SignupObserver] ❌ FAILED: Side-effects lost for user=${userId}. Error:`, err.message);
      }
    });
  }
}

module.exports = SignupObserver;
