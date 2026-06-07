const express = require('express');
const cors = require('cors');
const publicRoutes = require('./routes/publicRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminRoutes = require('./routes/adminRoutes');

const app = express();

// Middlewares
app.use(cors({
  origin: '*', // In production, replace with frontend and admin subdomain URLs
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Raw body parser is needed for webhook signature verification
// If the route is /api/payment/webhook, we parse it as raw buffer inside paymentRoutes instead,
// but for all other routes we parse it as standard JSON.
app.use((req, res, next) => {
  if (req.originalUrl === '/api/payment/webhook') {
    next();
  } else {
    express.json({ limit: '1mb' })(req, res, next);
  }
});

app.use(express.urlencoded({ extended: true }));

// Serve static assets placeholder if needed
// app.use('/static', express.static(path.join(__dirname, 'public')));

// Mounting API Routes
app.use('/api/public', publicRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Unhandled Server Error:', err.stack);
  res.status(err.status || 500).json({
    message: err.message || 'Internal Server Error occurred.'
  });
});

module.exports = app;
