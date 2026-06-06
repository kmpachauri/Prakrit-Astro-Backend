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
    enum: ['razorpay'],
    default: 'razorpay'
  },
  serviceType: {
    type: String,
    default: 'Jyotishi Consultation'
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

PaymentSchema.index({ status: 1, createdAt: -1 });
PaymentSchema.index({ customerId: 1, createdAt: -1 });
PaymentSchema.index({ paymentId: 1 });

module.exports = mongoose.model('Payment', PaymentSchema);
