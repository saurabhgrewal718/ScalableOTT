'use strict';

const { z } = require('zod');

const purchaseSchema = z.object({
  userId:      z.string().min(1, 'userId is required'),
  planId:      z.string().min(1, 'planId is required'),
  amount:      z.number().positive('amount must be positive'),
  currency:    z.string().default('INR'),
  email:       z.string().email('Valid email is required'),
});

module.exports = { purchaseSchema };
