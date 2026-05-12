'use strict';

const pino = require('pino');

/**
 * Staff-Level Logger (Pino)
 * 
 * Provides high-performance, asynchronous JSON logging.
 * Configures 'pino-pretty' for development and standard JSON for production.
 */
const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport: process.env.NODE_ENV === 'development' ? {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  } : undefined,
});

module.exports = logger;
