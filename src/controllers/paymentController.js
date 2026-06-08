const Customer = require('../models/Customer');
const LandingPage = require('../models/LandingPage');
const Payment = require('../models/Payment');
const razorpayProvider = require('../services/razorpayProvider');
const { ensureCareerBoostPage } = require('../utils/careerBoostPage');

const normalizePhone = (mobile = '') => mobile.replace(/[^\d]/g, '');
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const upsertCustomerForSuccessfulPayment = async (payment) => {
  if (payment.customerId) return payment.customerId;

  const snapshot = payment.customerSnapshot || {};
  const mobile = normalizePhone(snapshot.mobile);
  const email = normalizeEmail(snapshot.email);
  if (!snapshot.name || (!mobile && !email)) return null;

  let customer = null;
  if (mobile) {
    customer = await Customer.findOne({ mobile });
  }
  if (!customer && email) {
    customer = await Customer.findOne({ email });
  }
  if (!customer) {
    customer = new Customer({
      name: snapshot.name,
      mobile,
      email,
      state: snapshot.state,
      preferredLanguage: snapshot.preferredLanguage || 'hinglish',
      careerCategory: snapshot.careerCategory || payment.serviceType || '',
      notes: snapshot.notes || '',
      workflowStatus: 'new_payment',
      meetingDate: null,
      sourceLandingPage: payment.landingPageId
    });
  } else {
    customer.name = snapshot.name || customer.name;
    customer.mobile = mobile || customer.mobile;
    customer.email = email || customer.email;
    customer.state = snapshot.state || customer.state;
    customer.preferredLanguage = snapshot.preferredLanguage || customer.preferredLanguage;
    customer.careerCategory = snapshot.careerCategory || payment.serviceType || customer.careerCategory;
    customer.notes = snapshot.notes || customer.notes;
    customer.sourceLandingPage = payment.landingPageId || customer.sourceLandingPage;
    if (!customer.workflowStatus) {
      customer.workflowStatus = 'new_payment';
    }
  }

  await customer.save();
  payment.customerId = customer._id;
  await payment.save();
  return customer._id;
};

exports.createOrder = async (req, res) => {
  try {
    const { name, mobile, email, state, careerCategory, serviceType, preferredLanguage, notes, landingPageId, checkoutType, expectedAmount } = req.body;

    if (!name || !mobile || normalizePhone(mobile).length < 10) {
      return res.status(400).json({ message: 'Name and a valid mobile number are required.' });
    }

    if (!email || !String(email).trim()) {
      return res.status(400).json({ message: 'Email is required.' });
    }

    if (!state) {
      return res.status(400).json({ message: 'State is required.' });
    }

    const normalizedCheckoutType = checkoutType === 'personalized' ? 'personalized' : 'campaign';
    const targetPage = landingPageId
      ? await LandingPage.findById(landingPageId)
      : await ensureCareerBoostPage();

    if (!targetPage) {
      return res.status(404).json({ message: 'Active landing page configuration not found.' });
    }

    if (targetPage.settings && targetPage.settings.paymentEnabled === false) {
      return res.status(400).json({ message: 'Payments are currently disabled for this landing page.' });
    }

    const campaignAmount = Number(targetPage.pricing.offerPrice);
    const personalizedAmount = Number(targetPage.pricing.personalizedOfferPrice);
    const amount = normalizedCheckoutType === 'personalized' ? personalizedAmount : campaignAmount;
    const originalAmount = normalizedCheckoutType === 'personalized'
      ? Number(targetPage.pricing.personalizedOriginalPrice)
      : Number(targetPage.pricing.originalPrice);
    const currency = targetPage.pricing.currency || 'INR';
    const gateway = 'razorpay';
    const amountInPaise = Math.round(amount * 100);

    if (normalizedCheckoutType === 'personalized' && (!Number.isFinite(personalizedAmount) || amountInPaise < 100)) {
      return res.status(400).json({ message: 'Personalized pricing is not configured correctly. Please update it from the admin panel before taking payment.' });
    }

    if (!Number.isFinite(amount) || amountInPaise < 100) {
      return res.status(400).json({ message: 'Minimum payment amount is ₹1.' });
    }

    const normalizedExpectedAmount = Number(expectedAmount);
    if (Number.isFinite(normalizedExpectedAmount) && normalizedExpectedAmount !== amount) {
      return res.status(409).json({
        message: `Server price mismatch detected for ${normalizedCheckoutType} checkout. Expected ₹${normalizedExpectedAmount}, but configured amount is ₹${amount}.`,
        checkoutType: normalizedCheckoutType,
        expectedAmount: normalizedExpectedAmount,
        configuredAmount: amount
      });
    }

    const customerSnapshot = {
      name,
      mobile: normalizePhone(mobile),
      email: normalizeEmail(email),
      state,
      preferredLanguage: preferredLanguage || 'hinglish',
      careerCategory: careerCategory || serviceType || '',
      notes: notes || ''
    };
    const resolvedServiceType = normalizedCheckoutType === 'personalized'
      ? 'Personalized 1-to-1 Session'
      : (careerCategory || serviceType || 'Career Guidance');

    const orderId = `PA_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const gatewayOrder = await razorpayProvider.createOrder({
      amount,
      currency,
      receipt: orderId,
      customer: {
        name,
        email,
        mobile: normalizePhone(mobile),
        state
      },
      notes: {
        customerName: name,
        mobile: normalizePhone(mobile),
        email: normalizeEmail(email),
        state,
        serviceType: resolvedServiceType,
        checkoutType: normalizedCheckoutType,
        landingPageId: targetPage._id.toString()
      },
      redirectUrl: `${req.headers.origin || 'http://localhost:5173'}/payment-success?orderId=${orderId}`
    });

    const paymentRecord = await Payment.create({
      landingPageId: targetPage._id,
      orderId: gatewayOrder.orderId || orderId,
      amount,
      currency,
      status: 'pending',
      gateway,
      serviceType: resolvedServiceType,
      checkoutType: normalizedCheckoutType,
      whatsappGroupLinkAtPaymentTime: targetPage.settings?.whatsappGroupLink || '',
      customerSnapshot,
      rawResponse: {
        ...(gatewayOrder.raw || gatewayOrder),
        pricingContext: {
          checkoutType: normalizedCheckoutType,
          originalAmount
        }
      }
    });

    res.status(201).json({
      success: true,
      gateway,
      keyId: gatewayOrder.keyId || process.env.RAZORPAY_KEY_ID || '',
      orderId: paymentRecord.orderId,
      order_id: paymentRecord.orderId,
      amount,
      currency,
      paymentUrl: gatewayOrder.paymentUrl || '',
      mode: gatewayOrder.mode || 'razorpay',
      message: 'Payment order created.'
    });
  } catch (error) {
    console.error('Payment order creation error:', error);
    const statusCode = error.statusCode === 401 ? 401 : 500;
    res.status(statusCode).json({ message: error.message });
  }
};

exports.verifyPayment = async (req, res) => {
  try {
    const { orderId, paymentId, signature, rawResponse } = req.body;
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ success: false, message: 'orderId, paymentId and signature are required.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    const verification = await razorpayProvider.verifyPayment({
      orderId,
      paymentId,
      signature
    });

    payment.status = verification.success ? 'success' : 'failed';
    payment.paymentId = verification.paymentId || payment.paymentId;
    payment.rawResponse = {
      ...payment.rawResponse,
      checkout: rawResponse || {},
      verification: verification.raw || verification,
      verifiedAt: new Date()
    };
    await payment.save();

    if (!verification.success) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed.', payment });
    }

    await upsertCustomerForSuccessfulPayment(payment);
    res.json({ success: true, payment });
  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.markFailed = async (req, res) => {
  try {
    const { orderId, paymentId, rawResponse, reason } = req.body;
    if (!orderId) {
      return res.status(400).json({ success: false, message: 'orderId is required.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment record not found.' });
    }

    if (payment.status !== 'success') {
      payment.status = 'failed';
    }
    payment.paymentId = paymentId || payment.paymentId;
    payment.rawResponse = {
      ...payment.rawResponse,
      failure: rawResponse || {},
      failureReason: reason || rawResponse?.error?.description || 'checkout_failed',
      failedAt: new Date()
    };
    await payment.save();

    res.json({ success: true, payment });
  } catch (error) {
    console.error('Payment failed status update error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.webhook = async (req, res) => {
  try {
    const rawBody = Buffer.isBuffer(req.body) ? req.body.toString('utf8') : JSON.stringify(req.body);
    const signature = req.headers['x-razorpay-signature'];
    if (signature && process.env.RAZORPAY_WEBHOOK_SECRET) {
      const valid = razorpayProvider.verifyWebhookSignature(rawBody, signature);
      if (!valid) {
        return res.status(400).json({ received: false, message: 'Invalid webhook signature.' });
      }
    }
    const payload = rawBody ? JSON.parse(rawBody) : {};
    const orderId =
      payload?.payload?.payment?.entity?.order_id ||
      payload?.orderId;

    if (!orderId) {
      return res.status(200).json({ received: true, message: 'No order id in webhook payload.' });
    }

    const payment = await Payment.findOne({ orderId });
    if (!payment) {
      return res.status(200).json({ received: true, message: 'Payment record not found locally.' });
    }

    if (payload?.event === 'payment.captured') {
      payment.status = 'success';
    } else if (payload?.event === 'payment.failed') {
      payment.status = 'failed';
    }
    payment.paymentId = payload?.payload?.payment?.entity?.id || payment.paymentId;
    payment.rawResponse = { ...payment.rawResponse, webhook: payload };
    await payment.save();
    if (payment.status === 'success') {
      await upsertCustomerForSuccessfulPayment(payment);
    }

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
