const express = require('express');
const router = express.Router();
const publicController = require('../controllers/publicController');

router.get('/site-settings', publicController.getSiteSettings);
router.get('/active-landing-page', publicController.getActiveLandingPage);
router.get('/landing-page/:slug', publicController.getLandingPageBySlug);
router.get('/testimonials', publicController.getTestimonials);
router.get('/faqs', publicController.getFAQs);

module.exports = router;
