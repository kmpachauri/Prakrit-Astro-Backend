const Admin = require('../models/Admin');
const LandingPage = require('../models/LandingPage');
const SiteSetting = require('../models/SiteSetting');
const Customer = require('../models/Customer');
const Payment = require('../models/Payment');
const Testimonial = require('../models/Testimonial');
const FAQ = require('../models/FAQ');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { ensureCareerBoostPage } = require('../utils/careerBoostPage');

// Admin Login
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required.' });
    }

    const admin = await Admin.findOne({ email });
    if (!admin || admin.status !== 'active') {
      return res.status(401).json({ message: 'Invalid credentials or inactive account.' });
    }

    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials.' });
    }

    const token = jwt.sign(
      { id: admin._id, role: admin.role, email: admin.email },
      process.env.JWT_SECRET || 'fallback_secret_prakrit',
      { expiresIn: '7d' }
    );

    res.json({
      token,
      admin: {
        id: admin._id,
        name: admin.name,
        email: admin.email,
        role: admin.role
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get current admin
exports.getMe = async (req, res) => {
  try {
    const admin = await Admin.findById(req.user.id).select('-passwordHash');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found.' });
    }
    res.json(admin);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Dashboard Analytics
exports.getDashboard = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    // 1. Calculations from DB
    const allSuccessfulPayments = await Payment.find({ status: 'success' });
    const todaySuccessfulPayments = await Payment.find({
      status: 'success',
      createdAt: { $gte: startOfToday }
    });

    const totalRevenue = allSuccessfulPayments.reduce((acc, p) => acc + p.amount, 0);
    const todayRevenue = todaySuccessfulPayments.reduce((acc, p) => acc + p.amount, 0);

    const totalPaymentsCount = await Payment.countDocuments();
    const successfulPaymentsCount = allSuccessfulPayments.length;
    const failedPaymentsCount = await Payment.countDocuments({ status: 'failed' });
    const pendingPaymentsCount = await Payment.countDocuments({ status: 'pending' });

    const totalCustomersCount = await Customer.countDocuments();

    const page = await ensureCareerBoostPage();

    res.json({
      metrics: {
        totalRevenue,
        todayRevenue,
        totalPayments: totalPaymentsCount,
        successfulPayments: successfulPaymentsCount,
        failedPayments: failedPaymentsCount,
        pendingPayments: pendingPaymentsCount,
        totalCustomers: totalCustomersCount,
        activeLandingPage: page.name,
        currentOfferPrice: page.pricing.offerPrice,
        activeMeetingMode: page.settings?.meetingMode || 'zoom'
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Payments History (Search, filter, export CSV)
exports.getPayments = async (req, res) => {
  try {
    const { status, search, startDate, endDate, exportCsv } = req.query;
    let query = {};

    // Filter by status
    if (status) {
      query.status = status;
    }

    // Filter by date range
    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    // Process searches (Search by orderId, paymentId, or customer fields)
    let payments = [];
    if (search) {
      // Find matching customers first
      const matchedCustomers = await Customer.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { mobile: { $regex: search, $options: 'i' } },
          { email: { $regex: search, $options: 'i' } }
        ]
      });

      const customerIds = matchedCustomers.map(c => c._id);
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { paymentId: { $regex: search, $options: 'i' } },
        { customerId: { $in: customerIds } }
      ];
    }

    payments = await Payment.find(query)
      .populate('customerId')
      .populate('landingPageId')
      .sort({ createdAt: -1 });

    // Handle CSV exporting
    if (exportCsv === 'true') {
      let csvContent = 'Date,Customer Name,Mobile,Email,Service,Amount,Status,Gateway,Order ID,Payment ID,Meeting Mode\n';
      
      payments.forEach(p => {
        const date = p.createdAt.toISOString().slice(0, 10);
        const name = p.customerId ? p.customerId.name.replace(/,/g, ' ') : 'N/A';
        const mobile = p.customerId ? p.customerId.mobile : 'N/A';
        const email = p.customerId && p.customerId.email ? p.customerId.email : 'N/A';
      const service = p.serviceType ? p.serviceType.replace(/,/g, ' ') : 'N/A';
      const amount = p.amount;
      const status = p.status;
      const gateway = p.gateway;
      const orderId = p.orderId;
      const paymentId = p.paymentId || 'N/A';
      const meetingMode = p.meetingMode || 'N/A';

        csvContent += `${date},${name},${mobile},${email},${service},${amount},${status},${gateway},${orderId},${paymentId},${meetingMode}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=payments_history.csv');
      return res.status(200).send(csvContent);
    }

    res.json(payments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get single payment details
exports.getPaymentById = async (req, res) => {
  try {
    const payment = await Payment.findById(req.params.id)
      .populate('customerId')
      .populate('landingPageId');
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }
    res.json(payment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Payment status manually
exports.updatePaymentStatus = async (req, res) => {
  try {
    const { status } = req.body;
    const payment = await Payment.findById(req.params.id);
    if (!payment) {
      return res.status(404).json({ message: 'Payment record not found.' });
    }

    payment.status = status;
    await payment.save();
    res.json({ message: 'Payment status updated.', payment });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get Customers
exports.getCustomers = async (req, res) => {
  try {
    const customers = await Customer.find().sort({ createdAt: -1 });
    
    // Supplement each customer with their last payment status
    const customerList = await Promise.all(
      customers.map(async c => {
        const lastPayment = await Payment.findOne({ customerId: c._id }).sort({ createdAt: -1 });
        return {
          ...c.toObject(),
          paymentStatus: lastPayment ? lastPayment.status : 'N/A',
          lastPaymentAmount: lastPayment ? lastPayment.amount : 0
        };
      })
    );

    res.json(customerList);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET Landing pages list
exports.getLandingPages = async (req, res) => {
  try {
    const pages = await LandingPage.find().sort({ createdAt: -1 });
    res.json(pages);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Create Landing Page Template
exports.createLandingPage = async (req, res) => {
  try {
    const { name, slug, templateKey, pricing, seo, media, settings, content } = req.body;
    
    const existing = await LandingPage.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'Slug already exists.' });
    }

    const page = new LandingPage({
      name,
      slug,
      templateKey: templateKey || 'standard',
      pricing,
      seo,
      media,
      settings,
      content
    });

    await page.save();
    res.status(201).json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET Landing page details by ID
exports.getLandingPageById = async (req, res) => {
  try {
    const page = await LandingPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }
    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Edit Landing Page Content
exports.updateLandingPage = async (req, res) => {
  try {
    const page = await LandingPage.findByIdAndUpdate(
      req.params.id,
      { $set: req.body },
      { new: true, runValidators: true }
    );

    if (!page) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }

    res.json(page);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Activate Landing Page
exports.activateLandingPage = async (req, res) => {
  try {
    const pageId = req.params.id;

    // 1. Verify page exists
    const page = await LandingPage.findById(pageId);
    if (!page) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }

    // 2. Set all other pages to inactive
    await LandingPage.updateMany({ _id: { $ne: pageId } }, { $set: { isActive: false } });

    // 3. Set this page to active
    page.isActive = true;
    await page.save();

    // 4. Update SiteSetting active pointer
    let siteSettings = await SiteSetting.findOne();
    if (!siteSettings) {
      siteSettings = new SiteSetting({
        websiteName: 'Prakrit Astro',
        activeLandingPageId: page._id
      });
    } else {
      siteSettings.activeLandingPageId = page._id;
    }
    await siteSettings.save();

    res.json({ message: 'Landing page activated successfully.', page, siteSettings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// GET Site settings
exports.getSiteSettings = async (req, res) => {
  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting({
        websiteName: 'Prakrit Astro'
      });
      await settings.save();
    }
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Site settings
exports.updateSiteSettings = async (req, res) => {
  try {
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting(req.body);
    } else {
      Object.assign(settings, req.body);
    }
    await settings.save();
    res.json(settings);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Pricing directly for active page
exports.updatePricing = async (req, res) => {
  try {
    const { originalPrice, offerPrice, currency } = req.body;

    const page = await ensureCareerBoostPage();

    page.pricing.originalPrice = originalPrice;
    page.pricing.offerPrice = offerPrice;
    if (currency) page.pricing.currency = currency;

    await page.save();
    res.json({ message: 'Pricing updated successfully.', pricing: page.pricing });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update Payment settings
exports.updatePaymentSettings = async (req, res) => {
  try {
    const { paymentGateway } = req.body;
    let settings = await SiteSetting.findOne();
    if (!settings) {
      settings = new SiteSetting({ paymentGateway });
    } else {
      settings.paymentGateway = paymentGateway;
    }
    await settings.save();
    res.json({ message: 'Payment gateway settings updated.', settings });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Testimonials CRUD
exports.getTestimonials = async (req, res) => {
  try {
    const items = await Testimonial.find().sort({ createdAt: -1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createTestimonial = async (req, res) => {
  try {
    const item = new Testimonial(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateTestimonial = async (req, res) => {
  try {
    const item = await Testimonial.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteTestimonial = async (req, res) => {
  try {
    await Testimonial.findByIdAndDelete(req.params.id);
    res.json({ message: 'Testimonial deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// FAQs CRUD
exports.getFAQs = async (req, res) => {
  try {
    const items = await FAQ.find().sort({ order: 1 });
    res.json(items);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.createFAQ = async (req, res) => {
  try {
    const item = new FAQ(req.body);
    await item.save();
    res.status(201).json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateFAQ = async (req, res) => {
  try {
    const item = await FAQ.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(item);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.deleteFAQ = async (req, res) => {
  try {
    await FAQ.findByIdAndDelete(req.params.id);
    res.json({ message: 'FAQ deleted successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
