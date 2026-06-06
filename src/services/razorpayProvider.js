const Razorpay = require('razorpay');
const crypto = require('crypto');

class RazorpayProvider {
  constructor() {
    // These will be loaded at runtime from process.env
    this.keyId = process.env.RAZORPAY_KEY_ID;
    this.keySecret = process.env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

    // Initialize SDK lazily
    this.client = null;
  }

  getClient() {
    if (!this.client) {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials are not configured.');
      }
      this.client = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET,
      });
    }
    return this.client;
  }

  async createOrder({ amount, currency = 'INR', receipt }) {
    try {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay credentials are not configured.');
      }

      const razorpayClient = this.getClient();
      // Razorpay expects amount in the smallest currency unit (paisa for INR)
      const options = {
        amount: Math.round(amount * 100),
        currency,
        receipt,
      };
      
      const order = await razorpayClient.orders.create(options);
      return {
        success: true,
        mode: 'razorpay',
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        raw: order
      };
    } catch (error) {
      console.error('Razorpay Order Creation Failed:', error);
      const wrapped = new Error(`Razorpay Order Creation Failed: ${error.message}`);
      wrapped.statusCode = error.statusCode || error.status || error.response?.statusCode;
      throw wrapped;
    }
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    const success = this.verifySignature({ orderId, paymentId, signature });
    return {
      success,
      status: success ? 'success' : 'failed',
      paymentId,
      raw: { orderId, paymentId, signatureVerified: success }
    };
  }

  verifySignature({ orderId, paymentId, signature }) {
    try {
      if (!process.env.RAZORPAY_KEY_SECRET) {
        throw new Error('Razorpay key secret is not configured.');
      }
      const secret = process.env.RAZORPAY_KEY_SECRET;
      const text = `${orderId}|${paymentId}`;
      const generatedSignature = crypto
        .createHmac('sha256', secret)
        .update(text)
        .digest('hex');
      return generatedSignature === signature;
    } catch (error) {
      console.error('Signature Verification Error:', error);
      return false;
    }
  }

  verifyWebhookSignature(payload, signature) {
    try {
      if (!process.env.RAZORPAY_WEBHOOK_SECRET) {
        throw new Error('Razorpay webhook secret is not configured.');
      }
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
      const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return digest === signature;
    } catch (error) {
      console.error('Webhook Verification Error:', error);
      return false;
    }
  }
}

module.exports = new RazorpayProvider();
