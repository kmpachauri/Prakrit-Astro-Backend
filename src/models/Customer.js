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
  workflowStatus: {
    type: String,
    enum: ['new_payment', 'meeting_scheduled', 'meeting_completed'],
    default: 'new_payment'
  },
  meetingDate: {
    type: Date,
    default: null
  },
  phase2Status: {
    type: String,
    enum: ['p2_unscheduled', 'p2_meeting_scheduled', 'p2_meeting_completed'],
    default: 'p2_unscheduled'
  },
  phase2MeetingDate: {
    type: Date,
    default: null
  },
  phase2MeetingLink: {
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
CustomerSchema.index({ workflowStatus: 1, createdAt: -1 });

module.exports = mongoose.model('Customer', CustomerSchema);
