'use strict';

class WatchController {
  constructor(watchService, validation) {
    this.watchService = watchService;
    this.validation = validation;
  }

  /**
   * POST /watch/event
   */
  async handleVideoWatched(req, res, next) {
    try {
      const data   = req.validated;
      const result = await this.watchService.trackProgress(data);
      res.status(200).json({ status: true, ...result });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = WatchController;
