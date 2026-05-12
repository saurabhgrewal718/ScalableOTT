'use strict';

class PurchaseController {
  constructor(purchaseService, validation) {
    this.purchaseService = purchaseService;
    this.validation = validation;
  }

  /**
   * POST /purchase/complete
   */
  async handleContentPurchase(req, res, next) {
    try {
      const data     = req.validated;
      const purchase = await this.purchaseService.completePurchase(data);
      res.status(200).json({ 
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
