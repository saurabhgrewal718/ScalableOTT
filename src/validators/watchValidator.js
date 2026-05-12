'use strict';

const { z } = require('zod');

const watchEventSchema = z.object({
  userId:         z.string().min(1, 'userId is required'),
  contentId:      z.string().min(1, 'contentId is required'),
  watchedSeconds: z.number({ invalid_type_error: 'watchedSeconds must be a number' }).int().nonnegative(),
  sessionId:      z.string().min(1, 'sessionId is required'),
});

module.exports = { watchEventSchema };
