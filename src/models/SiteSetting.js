const mongoose = require('mongoose');

const SiteSettingSchema = new mongoose.Schema({
  websiteName: {
    type: String,
    required: true,
    default: 'Prakrit Astro'
  },
  logoUrl: {
    type: String,
    default: ''
  },
  defaultLanguage: {
    type: String,
    enum: ['hinglish', 'hindi', 'english'],
    default: 'hinglish'
  },
  whatsappNumber: {
    type: String,
    default: ''
  },
  supportEmail: {
    type: String,
    default: ''
  },
  businessAddress: {
    type: String,
    default: ''
  },
  activeLandingPageId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    default: null
  },
  paymentGateway: {
    type: String,
    enum: ['razorpay'],
    default: 'razorpay'
  },
  seo: {
    title: { type: String, default: 'Prakrit Astro' },
    description: { type: String, default: '' },
    keywords: [{ type: String }]
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('SiteSetting', SiteSettingSchema);
