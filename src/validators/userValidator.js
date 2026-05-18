'use strict';

const { z } = require('zod');

const userSignupSchema = z.object({
  userId:      z.string().min(1, 'userId is required'),
  email:       z.string().email('Invalid email address'),
  name:        z.string().min(1, 'name is required').max(100),
});

module.exports = { userSignupSchema };
