'use strict';

/**
 * src/middleware/errorHandler.js
 *
 * Centralized Express error handler.
 *
 * Error classification:
 *   400  — Validation errors (ZodError / manually thrown with statusCode 400)
 *   409  — Conflict (e.g. duplicate user)
 *   4xx  — Any operational error with an explicit statusCode
 *   500  — Unexpected / programmer errors
 *
 * In production, swap console.error for your structured logger (Pino / Winston).
 */

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, _next) {
  const isDev = process.env.NODE_ENV !== 'production';

  // Determine HTTP status
  const statusCode = err.statusCode || 500;

  // Build response body
  const body = {
    status:  false,
    error:   err.message || 'Internal Server Error',
    ...(err.details  && { details:  err.details }),   // validation detail array
    ...(err.code     && { code:     err.code }),       // machine-readable error code
    ...(isDev        && { stack:    err.stack }),      // stack trace in dev only
  };

  // Structured log
  if (statusCode >= 500) {
    console.error(`[errorHandler] ${req.method} ${req.path} → ${statusCode}`, err);
  } else {
    console.warn(`[errorHandler] ${req.method} ${req.path} → ${statusCode}: ${err.message}`);
  }

  res.status(statusCode).json(body);
}

module.exports = { errorHandler };
