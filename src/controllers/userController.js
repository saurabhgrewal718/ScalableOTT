'use strict';

const BaseController = require('./baseController');
const { userSignupSchema } = require('../validators/userValidator');

class UserController extends BaseController {
  constructor(userService) {
    super();
    this.userService = userService;
    this.setupRoutes();
  }

  /**
   * DECLARATIVE ROUTE MANIFEST
   */
  static get routes() {
    return [
      { method: 'post', path: '/signup', handler: 'handleUserSignup', schema: userSignupSchema },
    ];
  }

  async handleUserSignup(req, res, next) {
    try {
      const data = req.validated;
      const user = await this.userService.signupUser(data);

      res.status(201).json({
        status: true,
        message: 'User created',
        data: { userId: user.userId },
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
