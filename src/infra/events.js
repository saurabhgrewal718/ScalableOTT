'use strict';

const EventEmitter = require('events');

/**
 * A central Event Bus for Domain Events.
 * Enhanced with Global Logging for Observability.
 */
class DomainEvents extends EventEmitter {
  emit(eventName, data) {
    console.log(`[DomainEvents] 📣 EMIT: event="${eventName}" userId=${data?.userId || 'unknown'}`);
    return super.emit(eventName, data);
  }
}

module.exports = new DomainEvents();
