'use strict';

class UserController {
  constructor(userService, validation) {
    this.userService = userService;
    this.validation = validation;
  }

  /**
   * POST /user/signup
   */
  async handleUserSignup(req, res, next) {
    try {
      const data = req.validated;
      const user = await this.userService.signupUser(data);
      res.status(201).json({ status: true, message: 'User created', data: { userId: user.userId } });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = UserController;
