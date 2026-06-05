const express = require('express');
const router = express.Router();
const adminController = require('../controllers/adminController');
const auth = require('../middleware/auth');

// Public admin route
router.post('/login', adminController.login);

// Protected admin routes
router.get('/me', auth, adminController.getMe);
router.get('/dashboard', auth, adminController.getDashboard);

// Payments management
router.get('/payments', auth, adminController.getPayments);
router.get('/payments/:id', auth, adminController.getPaymentById);
router.put('/payments/:id/status', auth, adminController.updatePaymentStatus);

// Customers list
router.get('/customers', auth, adminController.getCustomers);

// Landing Pages management
router.get('/landing-pages', auth, adminController.getLandingPages);
router.post('/landing-pages', auth, adminController.createLandingPage);
router.get('/landing-pages/:id', auth, adminController.getLandingPageById);
router.put('/landing-pages/:id', auth, adminController.updateLandingPage);
router.put('/landing-pages/:id/activate', auth, adminController.activateLandingPage);

// Site & Pricing configurations
router.get('/site-settings', auth, adminController.getSiteSettings);
router.put('/site-settings', auth, adminController.updateSiteSettings);
router.put('/pricing', auth, adminController.updatePricing);
router.put('/payment-settings', auth, adminController.updatePaymentSettings);

// Testimonials CRUD
router.get('/testimonials', auth, adminController.getTestimonials);
router.post('/testimonials', auth, adminController.createTestimonial);
router.put('/testimonials/:id', auth, adminController.updateTestimonial);
router.delete('/testimonials/:id', auth, adminController.deleteTestimonial);

// FAQs CRUD
router.get('/faqs', auth, adminController.getFAQs);
router.post('/faqs', auth, adminController.createFAQ);
router.put('/faqs/:id', auth, adminController.updateFAQ);
router.delete('/faqs/:id', auth, adminController.deleteFAQ);

module.exports = router;
