const SiteSetting = require('../models/SiteSetting');
const LandingPage = require('../models/LandingPage');
const Testimonial = require('../models/Testimonial');
const FAQ = require('../models/FAQ');
const { ensureCareerBoostPage } = require('../utils/careerBoostPage');

exports.getSiteSettings = async (req, res) => {
  try {
    const settings = await SiteSetting.findOne();
    if (!settings) {
      return res.status(404).json({ message: 'Site settings not found' });
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getActiveLandingPage = async (req, res) => {
  try {
    const landingPage = await ensureCareerBoostPage();
    res.json(landingPage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getLandingPageBySlug = async (req, res) => {
  try {
    const landingPage = await LandingPage.findOne({ slug: req.params.slug });
    if (!landingPage) {
      return res.status(404).json({ message: 'Landing page not found' });
    }
    res.json(landingPage);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getTestimonials = async (req, res) => {
  try {
    const testimonials = await Testimonial.find({ isActive: true });
    res.json(testimonials);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFAQs = async (req, res) => {
  try {
    const faqs = await FAQ.find({ isActive: true }).sort({ order: 1 });
    res.json(faqs);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
