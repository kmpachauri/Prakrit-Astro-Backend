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
        console.warn('WARNING: Razorpay credentials are not set in environment variables.');
      }
      this.client = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID || 'mock_key_id',
        key_secret: process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret',
      });
    }
    return this.client;
  }

  async createOrder({ amount, currency = 'INR', receipt }) {
    try {
      if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
        const mockOrderId = `order_mock_${receipt || Date.now()}`;
        return {
          success: true,
          mode: 'mock',
          keyId: 'rzp_test_mock',
          orderId: mockOrderId,
          amount,
          currency,
          raw: { id: mockOrderId, amount: Math.round(amount * 100), currency, receipt }
        };
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
        mode: 'live',
        keyId: process.env.RAZORPAY_KEY_ID,
        orderId: order.id,
        amount: order.amount / 100,
        currency: order.currency,
        raw: order
      };
    } catch (error) {
      console.error('Razorpay Order Creation Failed:', error);
      throw new Error(`Razorpay Order Creation Failed: ${error.message}`);
    }
  }

  async verifyPayment({ orderId, paymentId, signature }) {
    if (!paymentId || !signature) {
      return { success: false, status: 'failed', paymentId, raw: { orderId, paymentId } };
    }

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
      const secret = process.env.RAZORPAY_KEY_SECRET || 'mock_key_secret';
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
      const secret = process.env.RAZORPAY_WEBHOOK_SECRET || 'mock_webhook_secret';
      const digest = crypto.createHmac('sha256', secret).update(payload).digest('hex');
      return digest === signature;
    } catch (error) {
      console.error('Webhook Verification Error:', error);
      return false;
    }
  }
}

module.exports = new RazorpayProvider();
