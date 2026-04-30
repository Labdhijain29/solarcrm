const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
app.set('trust proxy', 1);

// ─── Security Middleware ───────────────────────────────────────
app.use(helmet());

// ✅ CORS FIX (IMPORTANT)
const configuredOrigins = (process.env.CLIENT_URL || '')
  .split(',')
  .map(origin => origin.trim())
  .filter(Boolean);

const allowedOrigins = new Set([
  'https://mahavirsolar.com',
  'https://www.mahavirsolar.com',
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  ...configuredOrigins
]);

const isLocalDevOrigin = (origin) => {
  if (process.env.NODE_ENV !== 'development') return false;

  try {
    const { hostname } = new URL(origin);
    return hostname === 'localhost' || hostname === '127.0.0.1';
  } catch {
    return false;
  }
};

const corsOptions = {
  origin: function (origin, callback) {
    // Allow non-browser requests (Postman, mobile apps, curl)
    if (!origin) return callback(null, true);

    if (allowedOrigins.has(origin) || isLocalDevOrigin(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked for origin: ${origin}`));
  },
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));

// ✅ Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// ─── Rate Limiting ─────────────────────────────────────────────
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: {
    success: false,
    message: 'Too many requests, please try again later.'
  }
});
app.use('/api', limiter);

// ─── Body Parser ──────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// ─── Logger ──────────────────────────────────────────────────
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
}

// ─── Database Connection ──────────────────────────────────────
mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost:27017/solarcrm')
  .then(() => console.log('✅ MongoDB connected'))
  .catch(err => {
    console.error('❌ MongoDB connection error:', err);
    process.exit(1);
  });

// ─── Root Route ───────────────────────────────────────────────
app.get('/api', (req, res) => res.json({
  success: true,
  message: 'Welcome to Mahavir Solar APIs 🌞',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

// ─── Routes ──────────────────────────────────────────────────
app.use('/api/auth', require('./routes/auth.routes'));
app.use('/api/users', require('./routes/user.routes'));
app.use('/api/leads', require('./routes/lead.routes'));
app.use('/api/enquiries', require('./routes/enquiry.routes'));
app.use('/api/dashboard', require('./routes/dashboard.routes'));
app.use('/api/product', require('./routes/product.routes'));
app.use('/api/dispatch', require('./routes/dispatch.routes'));

// ─── Health Check ────────────────────────────────────────────
app.get('/api/health', (req, res) => res.json({
  success: true,
  message: 'SolarCRM API is running 🌞',
  version: '1.0.0',
  timestamp: new Date().toISOString()
}));

// ─── 404 Handler ─────────────────────────────────────────────
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ─── Global Error Handler ─────────────────────────────────────
app.use((err, req, res, next) => {
  console.error('Global Error:', err.stack);

  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: err.message
    });
  }
  

  const status = err.statusCode || 500;
  res.status(status).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// ─── Start Server ─────────────────────────────────────────────
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 SOLARCRM Backend running on http://localhost:${PORT}`);
  console.log(`📄 Environment: ${process.env.NODE_ENV}`);
});



module.exports = app;
