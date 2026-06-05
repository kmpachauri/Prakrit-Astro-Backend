const Customer = require('../models/Customer');
const LandingPage = require('../models/LandingPage');
const Payment = require('../models/Payment');
const SiteSetting = require('../models/SiteSetting');
const paymentService = require('../services/paymentService');
const { ensureCareerBoostPage } = require('../utils/careerBoostPage');

const normalizePhone = (mobile = '') => mobile.replace(/[^\d]/g, '');

const getGateway = async () => {
  const settings = await SiteSetting.findOne();
  return settings?.paymentGateway || process.env.ACTIVE_PAYMENT_GATEWAY || 'razorpay';
};

exports.createOrder = async (req, res) => {
  try {
    const { name, mobile, email, careerCategory, serviceType, preferredLanguage, notes, landingPageId } = req.body;

    if (!name || !mobile || normalizePhone(mobile).length < 10) {
      return res.status(400).json({ message: 'Name and a valid mobile number are required.' });
    }

    const targetPage = landingPageId
      ? await LandingPage.findById(landingPageId)
      : await ensureCareerBoostPage();

    if (!targetPage) {
      return res.status(404).json({ message: 'Active landing page configuration not found.' });
    }

    if (targetPage.settings && targetPage.settings.paymentEnabled === false) {
      return res.status(400).json({ message: 'Payments are currently disabled for this landing page.' });
    }

    const amount = Number(targetPage.pricing.offerPrice);
    const currency = targetPage.pricing.currency || 'INR';
    const gateway = await getGateway();

    let customer = await Customer.findOne({ mobile: normalizePhone(mobile) });
    if (!customer) {
      customer = new Customer({
        name,
        mobile: normalizePhone(mobile),
        email,
        preferredLanguage: preferredLanguage || 'hinglish',
        careerCategory: careerCategory || serviceType || '',
        notes: notes || '',
        sourceLandingPage: targetPage._id
      });
    } else {
      customer.name = name;
      customer.email = email || customer.email;
      customer.preferredLanguage = preferredLanguage || customer.preferredLanguage;
      customer.careerCategory = careerCategory || serviceType || customer.careerCategory;
      customer.notes = notes || customer.notes;
      customer.sourceLandingPage = targetPage._id;
    }
    await customer.save();

    const orderId = `PA_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const gatewayOrder = await paymentService.createOrder({
      gateway,
      amount,
      currency,
      receipt: orderId,
      customer: {
        id: customer._id.toString(),
        name,
        email,
        mobile: normalizePhone(mobile)
      },
      redirectUrl: `${req.headers.origin || 'http://localhost:5173'}/payment-success?orderId=${orderId}`
    });

    const paymentRecord = await Payment.create({
      customerId: customer._id,
      landingPageId: targetPage._id,
      orderId: gatewayOrder.orderId || orderId,
      amount,
      currency,
      status: 'pending',
      gateway,
      serviceType: careerCategory || serviceType || 'Career Guidance',
      meetingMode: targetPage.settings?.meetingMode || '',
      whatsappGroupLinkAtPaymentTime: targetPage.settings?.whatsappGroupLink || '',
      rawResponse: gatewayOrder.raw || gatewayOrder
    });

    res.status(201).json({
      success: true,
      gateway,
      keyId: gatewayOrder.keyId || process.env.RAZORPAY_KEY_ID || '',
      orderId: paymentRecord.orderId,
      amount,
      currency,
      paymentUrl: gatewayOrder.paymentUrl || '',
      mode: gatewayOrder.mode || 'live',
      message: gatewayOrder.mode === 'mock'
        ? 'Mock payment order created. Add gateway credentials to enable live checkout.'
        : 'Payment order created.'
    });
  } catch (error) {
    console.error('Payment order creation error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, rawResponse } = req.body;
    if (!orderId) {
      return res.status(400).json({ message: 'orderId is required.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const verification = await paymentService.verifyPayment({
      gateway: payment.gateway,
      orderId,
      paymentId,
      signature
    });

    payment.status = verification.status || (verification.success ? 'success' : 'failed');
    payment.paymentId = verification.paymentId || payment.paymentId;
    payment.rawResponse = {
      ...payment.rawResponse,
      checkout: rawResponse || {},
      verification: verification.raw || verification,
      verifiedAt: new Date()
    };
    await payment.save();

    res.json({ success: verification.success, payment });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'];
    if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
      const valid = paymentService.verifyWebhookSignature({
        gateway: 'razorpay',
        body: rawBody,
        signature
      });
      if (!valid) {
        return res.status(400).json({ received: false, message: 'Invalid webhook signature.' });
      }
    }
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const orderId =
      payload?.payload?.payment?.entity?.order_id ||
      payload?.data?.merchantTransactionId ||
      payload?.merchantTransactionId ||
      payload?.orderId;

    if (!orderId) {
      return res.status(200).json({ received: true, message: 'No order id in webhook payload.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(200).json({ received: true, message: 'Payment record not found locally.' });
    }

    const code = payload?.code || payload?.data?.state || '';
    if (payload?.event === 'payment.captured' || code === 'PAYMENT_SUCCESS' || code === 'COMPLETED') {
      payment.status = 'success';
    } else if (payload?.event === 'payment.failed' || code === 'PAYMENT_ERROR' || code === 'FAILED') {
      payment.status = 'failed';
    }
    payment.paymentId = payload?.payload?.payment?.entity?.id || payload?.data?.transactionId || payment.paymentId;
    payment.rawResponse = { ...payment.rawResponse, webhook: payload };
    await payment.save();

    res.json({ received: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ message: error.message });
  }
};

exports.getOrderStatus = async (req, res) => {
  try {
    const payment = await Payment.findOne({ orderId: req.params.orderId })
      .populate('customerId')
      .populate('landingPageId');

    if (!payment) {
      return res.status(404).json({ message: 'Order not found.' });
    }

    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
