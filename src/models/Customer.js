const mongoose = require('mongoose');

const CustomerSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  mobile: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    trim: true,
    lowercase: true
  },
  state: {
    type: String,
    trim: true,
    default: ''
  },
  preferredLanguage: {
    type: String,
    enum: ['hinglish', 'hindi', 'english'],
    default: 'hinglish'
  },
  careerCategory: {
    type: String,
    default: ''
  },
  notes: {
    type: String,
    default: ''
  },
  sourceLandingPage: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'LandingPage',
    default: null
  }
}, {
  timestamps: true
});

CustomerSchema.index({ mobile: 1 });
CustomerSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Customer', CustomerSchema);
