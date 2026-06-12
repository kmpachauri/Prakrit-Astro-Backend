const mongoose = require('mongoose');

const LandingPageSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  templateKey: {
    type: String,
    default: 'standard'
  },
  isActive: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  content: {
    hinglish: { type: mongoose.Schema.Types.Mixed, default: {} },
    hindi: { type: mongoose.Schema.Types.Mixed, default: {} },
    english: { type: mongoose.Schema.Types.Mixed, default: {} }
  },
  pricing: {
    originalPrice: { type: Number, required: true },
    offerPrice: { type: Number, required: true },
    personalizedOriginalPrice: { type: Number, default: 0 },
    personalizedOfferPrice: { type: Number, default: 0 },
    currency: { type: String, default: 'INR' }
  },
  settings: {
    whatsappNumber: { type: String, default: '' },
    supportEmail: { type: String, default: '' },
    businessAddress: { type: String, default: '' },
    countdownEnabled: { type: Boolean, default: true },
    countdownHours: { type: Number, default: 2 },
    countdownMinutes: { type: Number, default: 0 },
    paymentEnabled: { type: Boolean, default: true },
    whatsappGroupLink: { type: String, default: '' },
    categoryOptions: {
      type: [String],
      default: undefined
    },
    paymentPageContent: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    formFields: {
      type: mongoose.Schema.Types.Mixed,
      default: {}
    },
    contentVersion: { type: Number, default: 1 }
  },
  versionHistory: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LandingPage', LandingPageSchema);
