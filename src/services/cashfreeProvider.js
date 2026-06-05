class CashfreeProvider {
  constructor() {
    this.name = 'cashfree';
  }

  async createOrder({ amount, currency = 'INR', receipt }) {
    return {
      success: false,
      orderId: receipt,
      amount,
      currency,
      gateway: this.name,
      paymentUrl: '',
      raw: { message: 'Cashfree provider is scaffolded for a future fallback integration.' }
    };
  }

  async verifyPayment() {
    return {
      success: false,
      status: 'pending',
      paymentId: '',
      raw: { message: 'Cashfree verification is not active yet.' }
    };
  }

  verifyWebhookSignature() {
    return false;
  }
}

module.exports = new CashfreeProvider();
