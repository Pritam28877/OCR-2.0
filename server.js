require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const path = require('path');

// Import configurations and middleware
const connectDB = require('./src/config/database');
const { initializeFirebase } = require('./src/config/firebase');
const errorHandler = require('./src/middleware/errorHandler');
const { specs, swaggerUi, swaggerOptions } = require('./src/config/swagger');

// Import routes
const authRoutes = require('./src/routes/authRoutes');
const productRoutes = require('./src/routes/productRoutes');
const quotationRoutes = require('./src/routes/quotationRoutes');
const ocrRoutes = require('./src/routes/ocrRoutes');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// Initialize Firebase
initializeFirebase();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// CORS configuration
const corsOptions = {
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
};
app.use(cors(corsOptions));

// Compression middleware
app.use(compression());

// Logging middleware
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan(process.env.NODE_ENV === 'production' ? 'combined' : 'dev'));
}

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Add processing time tracking for OCR requests
app.use('/api/ocr', (req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Static file serving for uploads
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// API Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

/**
 * @swagger
 * /api/health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: Server is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "Server is running"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                 environment:
 *                   type: string
 *                   example: "development"
 *                 version:
 *                   type: string
 *                   example: "1.0.0"
 */
app.get('/api/health', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
    version: process.env.npm_package_version || '1.0.0'
  });
});

/**
 * @swagger
 * /api:
 *   get:
 *     summary: API information endpoint
 *     tags: [System]
 *     responses:
 *       200:
 *         description: API information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 documentation:
 *                   type: string
 *                 endpoints:
 *                   type: object
 */
app.get('/api', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OCR Product Quotation System API',
    documentation: '/api-docs',
    endpoints: {
      auth: '/api/auth',
      products: '/api/products',
      quotations: '/api/quotations',
      ocr: '/api/ocr',
      health: '/api/health'
    }
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);
app.use('/api/ocr', ocrRoutes);

// Handle 404 for API routes
app.use('/api', (req, res, next) => {
  // Only handle if no other route matched
  if (!res.headersSent) {
    res.status(404).json({
      success: false,
      error: 'API endpoint not found',
      path: req.originalUrl,
      method: req.method
    });
  }
});

// Root route
app.get('/', (req, res) => {
  res.status(200).json({
    success: true,
    message: 'OCR Product Quotation System API',
    documentation: '/api-docs',
    api: '/api'
  });
});

// Global error handler (must be last)
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Promise Rejection:', err.message);
  // Close server & exit process
  server.close(() => {
    process.exit(1);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err.message);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

const PORT = process.env.PORT || 8080;

const server = app.listen(PORT, () => {
  console.log(`
🚀 OCR Product Quotation System API Server Started
📍 Environment: ${process.env.NODE_ENV || 'development'}
🌐 Server running on port ${PORT}
📚 API Documentation: http://localhost:${PORT}/api-docs
🔗 API Base URL: http://localhost:${PORT}/api
💾 Database: ${process.env.MONGODB_URI ? 'Connected' : 'Not configured'}
🔐 Authentication: ${process.env.DISABLE_AUTH === 'true' ? 'Disabled (Development)' : 'Enabled (Firebase Phone Auth)'}
📊 Rate Limiting: ${process.env.RATE_LIMIT_MAX || 100} requests per ${(process.env.RATE_LIMIT_WINDOW_MS || 60000) / 1000}s
  `);
});

module.exports = app;
