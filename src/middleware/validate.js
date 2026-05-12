'use strict';

/**
 * src/middleware/validate.js
 *
 * Factory that returns an Express middleware which:
 *  1. Parses req.body against a Zod schema.
 *  2. On success  → attaches the parsed (coerced) data to req.validated and calls next().
 *  3. On failure  → calls next(error) with a structured 400 error.
 *
 * @param {import('zod').ZodSchema} schema
 * @returns {import('express').RequestHandler}
 */
function validate(schema) {
  return function validationMiddleware(req, _res, next) {
    const result = schema.safeParse(req.body);
    if (result.success) {
      req.validated = result.data;
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
