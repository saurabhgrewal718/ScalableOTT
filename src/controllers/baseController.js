'use strict';

const { Router } = require('express');
const { validate } = require('../middleware/validate');

/**
 * BaseController
 * 
 * Centralizes the Express routing boilerplate. Subclasses simply define
 * a static 'routes' manifest to expose their functionality.
 */
class BaseController {
  constructor() {
    this.router = Router();
  }

  /**
   * Iterates through the static 'routes' manifest and mounts them to the router.
   */
  setupRoutes() {
    const routes = this.constructor.routes || [];
    
    routes.forEach(({ method, path, handler, schema }) => {
      const middlewares = [];
      
      if (schema) {
        middlewares.push(validate(schema));
      }

      // Bind the handler to 'this' to ensure class context is preserved
      this.router[method](
        path, 
        ...middlewares, 
        this[handler].bind(this)
      );
    });
  }
}

module.exports = BaseController;
