'use strict';

/**
 * src/middleware/validate.js
 *
 * Factory that returns an Express middleware which:
 *  1. Parses req.body against a Zod schema.
 *  2. Extracts infrastructure metadata from headers (Idempotency, Platform, DeviceToken).
 *  3. On success  → attaches the combined data to req.validated and calls next().
 */
function validate(schema) {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse(req.body);
    
    if (result.success) {
      // Pull metadata from headers (Industry Standard for scale)
      const idempotencyKey = req.headers['idempotency-key'] || req.headers['x-idempotency-key'];
      const platform       = req.headers['x-platform'] || req.headers['platform'];
      const deviceToken    = req.headers['x-device-token'] || req.headers['device-token'];
      
      req.validated = {
        ...result.data,
        idempotencyKey: idempotencyKey || null,
        platform:       platform || 'unknown',
        deviceToken:    deviceToken || null,
      };
      
      return next();
    }

    const err = new Error('Validation failed');
    err.statusCode = 400;
    err.details    = result.error.errors.map((e) => ({
      field:   e.path.join('.'),
      message: e.message,
    }));
    return next(err);
  };
}

module.exports = { validate };
