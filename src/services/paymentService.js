const phonepeProvider = require('./phonepeProvider');
const cashfreeProvider = require('./cashfreeProvider');
const razorpayProvider = require('./razorpayProvider');

const providers = {
  razorpay: razorpayProvider,
  phonepe: phonepeProvider,
  cashfree: cashfreeProvider
};

class PaymentService {
  getProvider(gateway = process.env.ACTIVE_PAYMENT_GATEWAY || 'razorpay') {
    return providers[gateway] || razorpayProvider;
  }

  async createOrder(payload) {
    return this.getProvider(payload.gateway).createOrder(payload);
  }

  async verifyPayment(payload) {
    return this.getProvider(payload.gateway).verifyPayment(payload);
  }

  verifyWebhookSignature(payload) {
    return this.getProvider(payload.gateway).verifyWebhookSignature(payload.body, payload.signature);
  }
}

module.exports = new PaymentService();
