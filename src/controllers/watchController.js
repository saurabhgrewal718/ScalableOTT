'use strict';

const BaseController = require('./baseController');
const { watchEventSchema } = require('../validators/watchValidator');

class WatchController extends BaseController {
  constructor(watchService) {
    super();
    this.watchService = watchService;
    this.setupRoutes();
  }

  /**
   * DECLARATIVE ROUTE MANIFEST
   */
  static get routes() {
    return [
      { method: 'post', path: '/event', handler: 'handleVideoWatched', schema: watchEventSchema },
    ];
  }

  async handleVideoWatched(req, res, next) {
    try {
      const data = req.validated;
      await this.watchService.trackProgress(data);
      
      res.status(200).json({ status: true, message: 'Progress recorded' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WatchController;
