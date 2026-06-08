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
const CUSTOMER_WORKFLOW_STATUSES = ['new_payment', 'meeting_scheduled', 'meeting_completed'];
const PHASE2_WORKFLOW_STATUSES = ['p2_unscheduled', 'p2_meeting_scheduled', 'p2_meeting_completed'];
const normalizePhone = (mobile = '') => String(mobile).replace(/[^\d]/g, '');
const normalizeEmail = (email = '') => String(email).trim().toLowerCase();

const normalizeCountdownSettings = (settings = {}) => {
  if (!Object.prototype.hasOwnProperty.call(settings, 'countdownHours') &&
      !Object.prototype.hasOwnProperty.call(settings, 'countdownMinutes') &&
      !Object.prototype.hasOwnProperty.call(settings, 'countdownEnabled')) {
    return settings;
  }

  const nextHours = Number(settings.countdownHours);
  const nextMinutes = Number(settings.countdownMinutes);

  if (!Number.isInteger(nextHours) || nextHours < 0) {
    throw new Error('Countdown hours must be 0 or more.');
  }

  if (!Number.isInteger(nextMinutes) || nextMinutes < 0 || nextMinutes > 59) {
    throw new Error('Countdown minutes must be between 0 and 59.');
  }

  if (nextHours === 0 && nextMinutes === 0) {
    throw new Error('When countdown hours is 0, countdown minutes must be at least 1.');
  }

  return {
    ...settings,
    countdownEnabled: true,
    countdownHours: nextHours,
    countdownMinutes: nextMinutes
  };
};

const parseOptionalPrice = (value, fieldLabel) => {
  if (typeof value === 'undefined') return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`${fieldLabel} must be a valid price of 0 or more.`);
  }
  return parsed;
};

const ensureCustomerLinksForSuccessfulPayments = async () => {
  const orphanPayments = await Payment.find({
    status: 'success',
    customerId: null
  }).sort({ createdAt: 1 });

  for (const payment of orphanPayments) {
    const snapshot = payment.customerSnapshot || {};
    const mobile = normalizePhone(snapshot.mobile);
    const email = normalizeEmail(snapshot.email);
    if (!snapshot.name || (!mobile && !email)) {
      continue;
    }

    let customer = null;
    if (mobile) {
      customer = await Customer.findOne({ mobile });
    }
    if (!customer && email) {
      customer = await Customer.findOne({ email });
    }

    if (!customer) {
      customer = await Customer.create({
        name: snapshot.name,
        mobile,
        email,
        state: snapshot.state || '',
        preferredLanguage: snapshot.preferredLanguage || 'hinglish',
        careerCategory: snapshot.careerCategory || payment.serviceType || '',
        notes: snapshot.notes || '',
        workflowStatus: 'new_payment',
        meetingDate: null,
        sourceLandingPage: payment.landingPageId || null
      });
    } else {
      customer.name = snapshot.name || customer.name;
      customer.mobile = mobile || customer.mobile;
      customer.email = email || customer.email;
      customer.state = snapshot.state || customer.state;
      customer.preferredLanguage = snapshot.preferredLanguage || customer.preferredLanguage;
      customer.careerCategory = snapshot.careerCategory || payment.serviceType || customer.careerCategory;
      customer.notes = snapshot.notes || customer.notes;
      if (!customer.workflowStatus) {
        customer.workflowStatus = 'new_payment';
      }
      await customer.save();
    }

    payment.customerId = customer._id;
    await payment.save();
  }

  const paidCustomerIds = await Payment.distinct('customerId', {
    status: 'success',
    customerId: { $ne: null }
  });

  await Customer.updateMany(
    {
      _id: { $in: paidCustomerIds },
      $or: [
        { workflowStatus: { $exists: false } },
        { workflowStatus: null },
        { workflowStatus: '' }
      ]
    },
    {
      $set: {
        workflowStatus: 'new_payment',
        meetingDate: null
      }
    }
  );
};

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

// Change current admin password
exports.changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required.' });
    }
    if (newPassword.length < 8) {
      return res.status(400).json({ message: 'New password must be at least 8 characters.' });
    }

    const admin = await Admin.findById(req.user.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found.' });
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect.' });
    }

    admin.passwordHash = await bcrypt.hash(newPassword, 10);
    await admin.save();
    res.json({ message: 'Password changed successfully.' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Dashboard Analytics
exports.getDashboard = async (req, res) => {
  try {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const [
      revenueStats,
      paymentStatusStats,
      successfulCustomerIds,
      page
    ] = await Promise.all([
      Payment.aggregate([
        { $match: { status: 'success' } },
        {
          $group: {
            _id: null,
            totalRevenue: { $sum: '$amount' },
            todayRevenue: {
              $sum: {
                $cond: [{ $gte: ['$createdAt', startOfToday] }, '$amount', 0]
              }
            },
            successfulPayments: { $sum: 1 }
          }
        }
      ]),
      Payment.aggregate([
        { $group: { _id: '$status', count: { $sum: 1 } } }
      ]),
      Payment.distinct('customerId', { status: 'success', customerId: { $ne: null } }),
      ensureCareerBoostPage()
    ]);

    const revenue = revenueStats[0] || {};
    const statusCounts = paymentStatusStats.reduce((acc, item) => {
      acc[item._id] = item.count;
      return acc;
    }, {});
    const totalPaymentsCount = paymentStatusStats.reduce((sum, item) => sum + item.count, 0);

    res.json({
      metrics: {
        totalRevenue: revenue.totalRevenue || 0,
        todayRevenue: revenue.todayRevenue || 0,
        totalPayments: totalPaymentsCount,
        successfulPayments: revenue.successfulPayments || 0,
        failedPayments: statusCounts.failed || 0,
        pendingPayments: statusCounts.pending || 0,
        totalCustomers: successfulCustomerIds.length,
        activeLandingPage: page.name,
        currentOfferPrice: page.pricing.offerPrice,
        currentPersonalizedOfferPrice: page.pricing.personalizedOfferPrice || 0
      },
      activePage: {
        _id: page._id,
        pricing: page.pricing,
        settings: page.settings
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
      if (endDate) {
        const inclusiveEnd = new Date(endDate);
        inclusiveEnd.setHours(23, 59, 59, 999);
        query.createdAt.$lte = inclusiveEnd;
      }
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
      let csvContent = 'Date,Customer Name,Mobile,Email,Service,Amount,Status,Gateway,Order ID,Payment ID\n';
      
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

        csvContent += `${date},${name},${mobile},${email},${service},${amount},${status},${gateway},${orderId},${paymentId}\n`;
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
    const { search, startDate, endDate, exportCsv, exportEmails, status, p2Status, dateField } = req.query;
    await ensureCustomerLinksForSuccessfulPayments();
    const paidCustomerIds = await Payment.distinct('customerId', { status: 'success', customerId: { $ne: null } });
    const baseQuery = { _id: { $in: paidCustomerIds } };
    const personalizedCustomerIds = await Payment.distinct('customerId', {
      status: 'success',
      checkoutType: 'personalized',
      customerId: { $ne: null }
    });

    if (search) {
      baseQuery.$or = [
        { name: { $regex: search, $options: 'i' } },
        { mobile: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { state: { $regex: search, $options: 'i' } },
        { careerCategory: { $regex: search, $options: 'i' } },
        { workflowStatus: { $regex: search, $options: 'i' } }
      ];
    }

    const selectedDateField = dateField === 'meeting_date' ? 'meetingDate' : 'createdAt';
    if (startDate || endDate) {
      baseQuery[selectedDateField] = {};
      if (startDate) {
        baseQuery[selectedDateField].$gte = new Date(startDate);
      }
      if (endDate) {
        const inclusiveEnd = new Date(endDate);
        inclusiveEnd.setHours(23, 59, 59, 999);
        baseQuery[selectedDateField].$lte = inclusiveEnd;
      }
    }

    const query = { ...baseQuery };
    if (CUSTOMER_WORKFLOW_STATUSES.includes(status)) {
      query.workflowStatus = status;
    } else if (status === 'personalized') {
      query._id = { $in: personalizedCustomerIds };
      if (PHASE2_WORKFLOW_STATUSES.includes(p2Status)) {
        query.phase2Status = p2Status;
      }
      if (startDate || endDate) {
        delete query.meetingDate;
        query.phase2MeetingDate = {};
        if (startDate) query.phase2MeetingDate.$gte = new Date(startDate);
        if (endDate) {
          const inclusiveEnd = new Date(endDate);
          inclusiveEnd.setHours(23, 59, 59, 999);
          query.phase2MeetingDate.$lte = inclusiveEnd;
        }
      }
    }

    const customers = await Customer.find(query).sort({ createdAt: -1 });
    const [allCount, newPaymentCount, meetingScheduledCount, meetingCompletedCount, personalizedCount] = await Promise.all([
      Customer.countDocuments(baseQuery),
      Customer.countDocuments({ ...baseQuery, workflowStatus: 'new_payment' }),
      Customer.countDocuments({ ...baseQuery, workflowStatus: 'meeting_scheduled' }),
      Customer.countDocuments({ ...baseQuery, workflowStatus: 'meeting_completed' }),
      Customer.countDocuments({ ...baseQuery, _id: { $in: personalizedCustomerIds } })
    ]);
    const customerIds = customers.map((customer) => customer._id);
    const successfulPayments = await Payment.find({
      customerId: { $in: customerIds },
      status: 'success'
    }).sort({ createdAt: -1 });

    const paymentMetaByCustomer = successfulPayments.reduce((acc, payment) => {
      const customerId = String(payment.customerId || '');
      if (!customerId) return acc;
      if (!acc[customerId]) {
        acc[customerId] = {
          lastPayment: payment,
          hasPersonalizedPayment: false
        };
      }
      if (payment.checkoutType === 'personalized') {
        acc[customerId].hasPersonalizedPayment = true;
      }
      return acc;
    }, {});

    const customerList = customers.map((customer) => {
      const meta = paymentMetaByCustomer[String(customer._id)] || {};
      return {
        ...customer.toObject(),
        paymentStatus: meta.lastPayment ? meta.lastPayment.status : 'N/A',
        lastPaymentAmount: meta.lastPayment ? meta.lastPayment.amount : 0,
        hasPersonalizedPayment: Boolean(meta.hasPersonalizedPayment),
        workflowStatus: customer.workflowStatus || 'new_payment',
        meetingDate: customer.meetingDate || null,
        phase2Status: customer.phase2Status || 'p2_unscheduled',
        phase2MeetingDate: customer.phase2MeetingDate || null,
        phase2MeetingLink: customer.phase2MeetingLink || ''
      };
    });

    if (exportEmails === 'true') {
      const uniqueEmails = [...new Set(
        customerList
          .map((customer) => (customer.email || '').trim().toLowerCase())
          .filter(Boolean)
      )];
      const csvContent = `Email\n${uniqueEmails.join('\n')}`;

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customer_emails.csv');
      return res.status(200).send(csvContent);
    }

    if (exportCsv === 'true') {
      let csvContent = 'Registered Date,Name,Mobile,Email,State,Category,Status,Meeting Date\n';
      customerList.forEach(c => {
        const date = c.createdAt.toISOString().slice(0, 10);
        const name = c.name ? c.name.replace(/,/g, ' ') : 'N/A';
        const mobile = c.mobile || 'N/A';
        const email = c.email || 'N/A';
        const state = c.state ? c.state.replace(/,/g, ' ') : 'N/A';
        const category = c.careerCategory ? c.careerCategory.replace(/,/g, ' ') : 'N/A';
        const workflowStatus = c.workflowStatus ? c.workflowStatus.replace(/_/g, ' ') : 'new payment';
        const meetingDate = c.meetingDate ? new Date(c.meetingDate).toISOString().slice(0, 10) : 'N/A';
        csvContent += `${date},${name},${mobile},${email},${state},${category},${workflowStatus},${meetingDate}\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=customers_history.csv');
      return res.status(200).send(csvContent);
    }

    res.json({
      customers: customerList,
      counts: {
        all: allCount,
        new_payment: newPaymentCount,
        meeting_scheduled: meetingScheduledCount,
        meeting_completed: meetingCompletedCount,
        personalized: personalizedCount
      }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.scheduleCustomerMeeting = async (req, res) => {
  try {
    await ensureCustomerLinksForSuccessfulPayments();
    const { meetingDate } = req.body;
    if (!meetingDate) {
      return res.status(400).json({ message: 'Meeting date is required.' });
    }

    const normalizedMeetingDate = new Date(meetingDate);
    if (Number.isNaN(normalizedMeetingDate.getTime())) {
      return res.status(400).json({ message: 'Meeting date is invalid.' });
    }

    const paidCustomerIds = await Payment.distinct('customerId', { status: 'success', customerId: { $ne: null } });
    const result = await Customer.updateMany(
      {
        _id: { $in: paidCustomerIds },
        workflowStatus: 'new_payment'
      },
      {
        $set: {
          workflowStatus: 'meeting_scheduled',
          meetingDate: normalizedMeetingDate
        }
      }
    );

    res.json({
      message: result.modifiedCount > 0 ? 'Meeting scheduled for new-payment customers.' : 'No new-payment customers found to schedule.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.completeScheduledMeetings = async (req, res) => {
  try {
    await ensureCustomerLinksForSuccessfulPayments();
    const paidCustomerIds = await Payment.distinct('customerId', { status: 'success', customerId: { $ne: null } });
    const result = await Customer.updateMany(
      {
        _id: { $in: paidCustomerIds },
        workflowStatus: 'meeting_scheduled'
      },
      {
        $set: {
          workflowStatus: 'meeting_completed'
        }
      }
    );

    res.json({
      message: result.modifiedCount > 0 ? 'Scheduled meetings marked as completed.' : 'No scheduled meetings found to complete.',
      modifiedCount: result.modifiedCount
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCustomerWorkflowStatus = async (req, res) => {
  try {
    const { workflowStatus } = req.body;
    if (!CUSTOMER_WORKFLOW_STATUSES.includes(workflowStatus)) {
      return res.status(400).json({ message: 'Invalid workflow status.' });
    }

    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    customer.workflowStatus = workflowStatus;
    if (workflowStatus !== 'meeting_scheduled') {
      customer.meetingDate = customer.meetingDate || null;
    }
    await customer.save();

    res.json({ message: 'Customer workflow status updated.', customer });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.updateCustomerPhase2Meeting = async (req, res) => {
  try {
    const { action, meetingDate, meetingLink } = req.body;
    const customer = await Customer.findById(req.params.id);
    if (!customer) {
      return res.status(404).json({ message: 'Customer not found.' });
    }

    if (action === 'schedule') {
      if (!meetingDate) {
        return res.status(400).json({ message: 'Meeting date & time is required.' });
      }
      if (!meetingLink || !String(meetingLink).trim()) {
        return res.status(400).json({ message: 'Meeting link is required.' });
      }
      const normalizedMeetingDate = new Date(meetingDate);
      if (Number.isNaN(normalizedMeetingDate.getTime())) {
        return res.status(400).json({ message: 'Meeting date & time is invalid.' });
      }
      customer.phase2Status = 'p2_meeting_scheduled';
      customer.phase2MeetingDate = normalizedMeetingDate;
      customer.phase2MeetingLink = String(meetingLink).trim();
      await customer.save();
      return res.json({ message: 'Phase 2 meeting scheduled.', customer });
    }

    if (action === 'complete') {
      customer.phase2Status = 'p2_meeting_completed';
      await customer.save();
      return res.json({ message: 'Phase 2 meeting marked completed.', customer });
    }

    return res.status(400).json({ message: 'Invalid phase 2 action.' });
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
    const { name, slug, templateKey, pricing, settings, content } = req.body;
    
    const existing = await LandingPage.findOne({ slug });
    if (existing) {
      return res.status(400).json({ message: 'Slug already exists.' });
    }

    const page = new LandingPage({
      name,
      slug,
      templateKey: templateKey || 'standard',
      pricing,
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
    const existingPage = await LandingPage.findById(req.params.id);
    if (!existingPage) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }

    const allowedFields = [
      'name',
      'slug',
      'templateKey',
      'isActive',
      'status',
      'content',
      'pricing',
      'settings'
    ];
    const updates = allowedFields.reduce((acc, field) => {
      if (Object.prototype.hasOwnProperty.call(req.body, field)) {
        acc[field] = req.body[field];
      }
      return acc;
    }, {});

    if (updates.settings) {
      updates.settings = normalizeCountdownSettings({
        ...(existingPage.settings || {}),
        ...updates.settings
      });
    }

    const snapshot = existingPage.toObject();
    delete snapshot.versionHistory;
    existingPage.versionHistory = [
      ...(existingPage.versionHistory || []).slice(-9),
      {
        savedAt: new Date(),
        page: snapshot
      }
    ];
    Object.assign(existingPage, updates);
    const page = await existingPage.save();

    if (updates.settings) {
      await SiteSetting.updateOne(
        {},
        {
          $set: {
            whatsappNumber: updates.settings.whatsappNumber || '',
            supportEmail: updates.settings.supportEmail || '',
            businessAddress: updates.settings.businessAddress || ''
          },
          $setOnInsert: { websiteName: 'Prakrit Astro', activeLandingPageId: page._id }
        },
        { upsert: true }
      );
    }

    if (!page) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }

    res.json(page);
  } catch (error) {
    const status = /Countdown/.test(error.message) ? 400 : 500;
    res.status(status).json({ message: error.message });
  }
};

// Restore previous landing page version
exports.restorePreviousLandingPage = async (req, res) => {
  try {
    const page = await LandingPage.findById(req.params.id);
    if (!page) {
      return res.status(404).json({ message: 'Landing page not found.' });
    }

    const previous = page.versionHistory?.pop();
    if (!previous?.page) {
      return res.status(400).json({ message: 'No previous version available.' });
    }

    const restored = previous.page;
    delete restored._id;
    delete restored.createdAt;
    delete restored.updatedAt;
    delete restored.__v;
    Object.assign(page, restored);
    await page.save();
    res.json({ message: 'Previous landing page version restored.', page });
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
    const {
      originalPrice,
      offerPrice,
      personalizedOriginalPrice,
      personalizedOfferPrice,
      currency
    } = req.body;

    const page = await ensureCareerBoostPage();
    const nextPricing = {
      originalPrice: Number(page.pricing?.originalPrice ?? 0),
      offerPrice: Number(page.pricing?.offerPrice ?? 0),
      personalizedOriginalPrice: Number(page.pricing?.personalizedOriginalPrice ?? page.pricing?.originalPrice ?? 0),
      personalizedOfferPrice: Number(page.pricing?.personalizedOfferPrice ?? page.pricing?.offerPrice ?? 0),
      currency: page.pricing?.currency || 'INR'
    };

    const nextOriginalPrice = parseOptionalPrice(originalPrice, 'Original price');
    const nextOfferPrice = parseOptionalPrice(offerPrice, 'Offer price');
    const nextPersonalizedOriginalPrice = parseOptionalPrice(personalizedOriginalPrice, 'Personalized original price');
    const nextPersonalizedOfferPrice = parseOptionalPrice(personalizedOfferPrice, 'Personalized offer price');

    if (typeof nextOriginalPrice !== 'undefined') {
      nextPricing.originalPrice = nextOriginalPrice;
    }
    if (typeof nextOfferPrice !== 'undefined') {
      nextPricing.offerPrice = nextOfferPrice;
    }
    if (typeof nextPersonalizedOriginalPrice !== 'undefined') {
      nextPricing.personalizedOriginalPrice = nextPersonalizedOriginalPrice;
    }
    if (typeof nextPersonalizedOfferPrice !== 'undefined') {
      nextPricing.personalizedOfferPrice = nextPersonalizedOfferPrice;
    }

    if (nextPricing.offerPrice > nextPricing.originalPrice) {
      throw new Error('Offer price cannot be greater than original price.');
    }
    if (nextPricing.personalizedOfferPrice > nextPricing.personalizedOriginalPrice) {
      throw new Error('Personalized offer price cannot be greater than personalized original price.');
    }

    if (currency) nextPricing.currency = currency;

    page.pricing = nextPricing;
    page.markModified('pricing');

    await page.save();
    res.json({ message: 'Pricing updated successfully.', pricing: page.pricing });
  } catch (error) {
    const status = /price/i.test(error.message) ? 400 : 500;
    res.status(status).json({ message: error.message });
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
    const question = (req.body.question || '').trim();
    const answer = (req.body.answer || '').trim();
    const existing = await FAQ.findOne({
      question: { $regex: `^${question.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' },
      answer: { $regex: `^${answer.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' }
    });
    if (existing) {
      return res.status(409).json({ message: 'This FAQ already exists.', item: existing });
    }
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
