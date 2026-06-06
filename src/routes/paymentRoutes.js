const express = require('express');
const router = express.Router();
const paymentController = require('../controllers/paymentController');

router.post('/create', paymentController.createOrder);
router.post('/verify', paymentController.verifyPayment);
router.post('/failed', paymentController.markFailed);
router.post('/webhook', express.raw({ type: 'application/json' }), paymentController.webhook);
router.get('/status/:orderId', paymentController.getOrderStatus);

module.exports = router;
