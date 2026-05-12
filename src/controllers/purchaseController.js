'use strict';

const BaseController = require('./baseController');
const { purchaseSchema } = require('../validators/purchaseValidator');

class PurchaseController extends BaseController {
  constructor(purchaseService) {
    super();
    this.purchaseService = purchaseService;
    this.setupRoutes();
  }

  /**
   * DECLARATIVE ROUTE MANIFEST
   */
  static get routes() {
    return [
      { method: 'post', path: '/complete', handler: 'handleContentPurchase', schema: purchaseSchema },
    ];
  }

  async handleContentPurchase(req, res, next) {
    try {
      const data     = req.validated;
      const purchase = await this.purchaseService.completePurchase(data);
      
      res.status(201).json({ 
        status: true, 
        message: 'Purchase recorded', 
        data: { purchaseId: purchase.id } 
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = PurchaseController;
