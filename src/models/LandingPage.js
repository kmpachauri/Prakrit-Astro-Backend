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
    currency: { type: String, default: 'INR' }
  },
  seo: {
    title: { type: String, default: '' },
    description: { type: String, default: '' },
    keywords: [{ type: String }]
  },
  media: {
    logo: { type: String, default: '' },
    heroImage: { type: String, default: '' },
    guruImage: { type: String, default: '' }
  },
  settings: {
    whatsappNumber: { type: String, default: '' },
    countdownEnabled: { type: Boolean, default: true },
    countdownHours: { type: Number, default: 2 },
    countdownMinutes: { type: Number, default: 0 },
    countdownEndTime: { type: Date },
    paymentEnabled: { type: Boolean, default: true },
    meetingMode: { type: String, enum: ['whatsapp_call', 'google_meet', 'zoom', 'phone_call', 'whatsapp_group'], default: 'zoom' },
    meetingDescription: { type: String, default: '' },
    whatsappGroupLink: { type: String, default: '' },
    offerText: { type: String, default: '' },
    timerHeadline: { type: String, default: '' },
    timerSubtext: { type: String, default: '' },
    contentVersion: { type: Number, default: 1 }
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('LandingPage', LandingPageSchema);
