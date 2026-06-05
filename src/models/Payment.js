const mongoose = require('mongoose');

const PaymentSchema = new mongoose.Schema({
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    default: null
  },
  landingPageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    default: null
  },
  orderId: {
    type: String,
    required: true,
    unique: true
  },
  paymentId: {
    type: String,
    default: ''
  },
  amount: {
    type: Number,
    required: true
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['pending', 'success', 'failed', 'refunded'],
    default: 'pending'
  },
  gateway: {
    type: String,
    enum: ['razorpay', 'phonepe', 'cashfree'],
    default: 'razorpay'
  },
  serviceType: {
    type: String,
    default: 'Jyotishi Consultation'
  },
  meetingMode: {
    type: String,
    default: ''
  },
  whatsappGroupLinkAtPaymentTime: {
    type: String,
    default: ''
  },
  rawResponse: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Payment', PaymentSchema);
