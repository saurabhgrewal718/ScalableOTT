'use strict';

const { z } = require('zod');

const userSignupSchema = z.object({
  userId:      z.string().min(1, 'userId is required'),
  email:       z.string().email('Invalid email address'),
  name:        z.string().min(1, 'name is required').max(100),
  deviceToken: z.string().min(1, 'deviceToken is required'),
  platform:    z.enum(['ios', 'android', 'web']).optional(),
});

module.exports = { userSignupSchema };
