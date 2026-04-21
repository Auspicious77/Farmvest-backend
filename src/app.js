const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const mongoSanitize = require('express-mongo-sanitize');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const fileUpload = require('express-fileupload');

// Import routes
const authRoutes = require('./routes/auth.routes');
const userRoutes = require('./routes/user.routes');
const walletRoutes = require('./routes/wallet.routes');
const productRoutes = require('./routes/product.routes');
const investmentRoutes = require('./routes/investment.routes');
const historyRoutes = require('./routes/history.routes');
const notificationRoutes = require('./routes/notification.routes');
const adminRoutes = require('./routes/admin.routes');
const webhookRoutes = require('./routes/webhook.routes');

// Import middleware
const { errorHandler } = require('./middleware/error.middleware');
const logger = require('./utils/logger');

const app = express();

// Security middleware
app.use(helmet());
app.use(mongoSanitize());

// CORS configuration - Updated for iPhone hotspot
const allowedOrigins = [
  process.env.ADMIN_URL,
  ...(process.env.CLIENT_URL ? process.env.CLIENT_URL.split(',') : []),
];

// Enhanced CORS configuration
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps, React Native, or Postman)
    if (!origin) {
      return callback(null, true);
    }
    
    // Log origin for debugging
    if (process.env.NODE_ENV === 'development') {
      logger.info(`CORS request from origin: ${origin}`);
    }
    
    // Check if origin is in allowed list
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (!allowedOrigin) return false;
      
      // Normalize URLs for comparison
      const normalizeUrl = (url) => {
        return url.replace(/https?:\/\//, '').replace(/:\d+$/, '');
      };
      
      const normalizedOrigin = normalizeUrl(origin);
      const normalizedAllowed = normalizeUrl(allowedOrigin);
      
      return normalizedOrigin.includes(normalizedAllowed) || 
             normalizedAllowed.includes(normalizedOrigin);
    });
    
    // Additional common development origins
    const commonDevOrigins = [
      'localhost',
      '127.0.0.1',
      '192.168.',
      '172.20.10.', // iPhone hotspot subnet
      '10.0.2.2',   // Android emulator
      'exp://',     // Expo
    ];
    
    const isCommonDevOrigin = commonDevOrigins.some(devOrigin => 
      origin.includes(devOrigin)
    );
    
    if (isAllowed || isCommonDevOrigin || process.env.NODE_ENV === 'development') {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked: ${origin}. Allowed: ${allowedOrigins.join(', ')}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'Accept',
    'Origin',
    'Access-Control-Request-Method',
    'Access-Control-Request-Headers'
  ],
  exposedHeaders: [
    'Content-Range',
    'X-Content-Range',
    'Access-Control-Expose-Headers'
  ],
  maxAge: 86400, // 24 hours
  preflightContinue: false,
  optionsSuccessStatus: 204
};

app.use(cors(corsOptions));

// Handle preflight requests
app.options('*', cors(corsOptions));

// Body parser
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// File upload
app.use(fileUpload({
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max file size
  useTempFiles: true,
  tempFileDir: '/tmp/',
}));

// Logging
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', { stream: logger.stream }));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

// More lenient rate limit for admin routes
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // Higher limit for admin operations
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/v1/admin', adminLimiter);
app.use('/api/v1', limiter);

// Enhanced Health check with CORS headers
app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Nestly API is running',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    clientIp: req.ip || req.connection.remoteAddress,
    origin: req.get('origin') || 'No origin header'
  });
});

// Add a test endpoint for mobile connectivity
app.get('/api/v1/mobile-test', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Mobile connection test successful',
    clientInfo: {
      ip: req.ip,
      userAgent: req.get('User-Agent'),
      origin: req.get('origin'),
      timestamp: new Date().toISOString()
    },
    serverInfo: {
      environment: process.env.NODE_ENV,
      corsEnabled: true,
      allowedOrigins: allowedOrigins
    }
  });
});

// API routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/wallet', walletRoutes);
app.use('/api/v1/products', productRoutes);
app.use('/api/v1/investments', investmentRoutes);
app.use('/api/v1/history', historyRoutes);
app.use('/api/v1/notifications', notificationRoutes);
app.use('/api/v1/admin', adminRoutes);
app.use('/api/v1/webhooks', webhookRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found`,
    method: req.method,
    allowedMethods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH']
  });
});

// Error handler (must be last)
app.use(errorHandler);

module.exports = app;