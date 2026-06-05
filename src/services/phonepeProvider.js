const crypto = require('crypto');

class PhonePeProvider {
  constructor() {
    this.name = 'phonepe';
  }

  getConfig() {
    return {
      merchantId: process.env.PHONEPE_MERCHANT_ID || '',
      saltKey: process.env.PHONEPE_SALT_KEY || '',
      saltIndex: process.env.PHONEPE_SALT_INDEX || '1',
      baseUrl: process.env.PHONEPE_BASE_URL || 'https://api-preprod.phonepe.com/apis/pg-sandbox',
      redirectUrl: process.env.PHONEPE_REDIRECT_URL || '',
      callbackUrl: process.env.PHONEPE_CALLBACK_URL || ''
    };
  }

  isConfigured() {
    const config = this.getConfig();
    return Boolean(config.merchantId && config.saltKey);
  }

  buildChecksum(payloadBase64, path) {
    const config = this.getConfig();
    const hash = crypto
      .createHash('sha256')
      .update(payloadBase64 + path + config.saltKey)
      .digest('hex');
    return `${hash}###${config.saltIndex}`;
  }

  async createOrder({ amount, currency, receipt, customer, redirectUrl }) {
    const config = this.getConfig();
    const merchantTransactionId = receipt;
    const amountInPaise = Math.round(Number(amount) * 100);
    const finalRedirectUrl =
      redirectUrl ||
      config.redirectUrl ||
      `http://localhost:5173/payment-success?orderId=${merchantTransactionId}`;

    const payload = {
      merchantId: config.merchantId || 'PHONEPE_MERCHANT_ID_NOT_SET',
      merchantTransactionId,
      merchantUserId: customer?.id || `user_${Date.now()}`,
      amount: amountInPaise,
      redirectUrl: finalRedirectUrl,
      redirectMode: 'REDIRECT',
      callbackUrl: config.callbackUrl || undefined,
      mobileNumber: customer?.mobile,
      paymentInstrument: {
        type: 'PAY_PAGE'
      }
    };

    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64');
    const apiPath = '/pg/v1/pay';
    const checksum = this.buildChecksum(payloadBase64, apiPath);

    if (!this.isConfigured()) {
      return {
        success: true,
        orderId: merchantTransactionId,
        gateway: this.name,
        paymentUrl: finalRedirectUrl,
        mode: 'mock',
        raw: {
          message: 'PhonePe credentials are not configured. Mock order created for local development.',
          request: payload,
          checksumPreview: checksum
        }
      };
    }

    const response = await fetch(`${config.baseUrl}${apiPath}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum
      },
      body: JSON.stringify({ request: payloadBase64 })
    });

    const data = await response.json();
    const paymentUrl = data?.data?.instrumentResponse?.redirectInfo?.url;

    if (!response.ok || !paymentUrl) {
      throw new Error(data?.message || 'PhonePe order creation failed.');
    }

    return {
      success: true,
      orderId: merchantTransactionId,
      gateway: this.name,
      paymentUrl,
      mode: 'live',
      raw: data
    };
  }

  async verifyPayment({ orderId }) {
    const config = this.getConfig();
    const apiPath = `/pg/v1/status/${config.merchantId}/${orderId}`;
    const checksum = this.buildChecksum('', apiPath);

    if (!this.isConfigured()) {
      return {
        success: true,
        status: 'success',
        paymentId: `mock_phonepe_${orderId}`,
        raw: { message: 'Mock verification because PhonePe credentials are not configured.' }
      };
    }

    const response = await fetch(`${config.baseUrl}${apiPath}`, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-VERIFY': checksum,
        'X-MERCHANT-ID': config.merchantId
      }
    });
    const data = await response.json();
    const code = data?.code || '';

    return {
      success: response.ok && code === 'PAYMENT_SUCCESS',
      status: code === 'PAYMENT_SUCCESS' ? 'success' : code === 'PAYMENT_ERROR' ? 'failed' : 'pending',
      paymentId: data?.data?.transactionId || '',
      raw: data
    };
  }

  verifyWebhookSignature() {
    return true;
  }
}

module.exports = new PhonePeProvider();
