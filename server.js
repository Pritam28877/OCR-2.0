require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const swaggerJsdoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');

const admin = require('./config/firebase');

const connectDB = require('./config/database');
const authRoutes = require('./routes/auth');
const ocrRoutes = require('./routes/ocr');
const productRoutes = require('./routes/products');
const quotationRoutes = require('./routes/quotations');

// Initialize Express app
const app = express();

// Security middleware
app.use(
  helmet.contentSecurityPolicy({
    directives: {
      ...helmet.contentSecurityPolicy.getDefaultDirectives(),
      "script-src": ["'self'", "https://www.gstatic.com", "https://www.google.com", "'unsafe-inline'"],
      "frame-src": ["'self'", "https://www.google.com"],
      "connect-src": ["'self'", "https://www.gstatic.com", "https://identitytoolkit.googleapis.com", "https://www.google.com"],
    },
  })
);


// CORS configuration
app.use(cors());

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again later.'
  }
});
app.use(limiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Serve static files from the 'public' directory or root
app.use(express.static('public'));
app.use(express.static(__dirname)); // Serves files from the project root

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'OCR Backend API',
      version: '1.0.0',
      description: 'OCR Backend API with Google Firebase Auth and Gemini API integration',
      contact: {
        name: 'API Support',
        email: 'support@example.com'
      }
    },
    servers: [
      {
        url: '/',
        description: 'API Server'
      }
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT'
        }
      }
    },
    security: [
      {
        bearerAuth: []
      }
    ]
  },
  apis: ['./routes/*.js']
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Swagger UI
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
  explorer: true,
  customCss: '.swagger-ui .topbar { display: none }',
  customSiteTitle: 'OCR Backend API Documentation'
}));

// Health check endpoint
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  const PORT = process.env.PORT || 8080;

  const healthStatus = {
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      server: '✅ Running',
      database: mongoose.connection.readyState === 1 ? '✅ Connected' : '❌ Disconnected',
      firebase: admin.apps.length > 0 ? '✅ Configured' : '⚠️  Not configured'
    },
    environment: process.env.NODE_ENV || 'development',
    port: PORT
  };

  // Determine overall status
  const allServicesUp = Object.values(healthStatus.services).every(service =>
    service.includes('✅') || service.includes('⚠️')
  );

  res.status(allServicesUp ? 200 : 503).json(healthStatus);
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/ocr', ocrRoutes);
app.use('/api/products', productRoutes);
app.use('/api/quotations', quotationRoutes);

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      message: 'Validation Error',
      error: err.message
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      message: 'Invalid ID format',
      error: err.message
    });
  }

  if (err.code === 11000) {
    return res.status(400).json({
      success: false,
      message: 'Duplicate field value',
      error: err.message
    });
  }

  // Default error response
  res.status(err.status || 500).json({
    success: false,
    message: err.message || 'Internal Server Error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Start server
const PORT = process.env.PORT || 8080;
const HOST = '0.0.0.0';

const startServer = async () => {
  try {
    // Connect to database
    await connectDB();
    console.log('📊 Database connected successfully');

    // Start listening
    app.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 OCR BACKEND SERVER STARTED');
      console.log('='.repeat(60));
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log(`📚 API Documentation: http://localhost:${PORT}/api-docs`);
      console.log(`🏥 Health Check: http://localhost:${PORT}/health`);
      console.log(`🔧 Environment: ${process.env.NODE_ENV || 'development'}`);
      console.log('='.repeat(60));
      console.log('✅ Server is ready to accept requests!');
      console.log('💡 Note: Firebase authentication is currently disabled.');
      console.log('🔧 Configure your .env file with valid Firebase credentials to enable auth.');
      console.log('='.repeat(60) + '\n');
    });
  } catch (error) {
    console.error('\n❌ Failed to start server:');
    console.error('Error:', error.message);
    console.error('\n🔧 Troubleshooting steps:');
    console.error('1. Make sure MongoDB is running');
    console.error('2. Check your .env file configuration');
    console.error('3. Verify all required environment variables are set');
    console.error('\n💡 Starting server without database for development...');

    // Start server even without database for development
    app.listen(PORT, HOST, () => {
      console.log('\n' + '='.repeat(60));
      console.log('🚀 SERVER STARTED (LIMITED MODE)');
      console.log('='.repeat(60));
      console.log(`📍 Server URL: http://localhost:${PORT}`);
      console.log('⚠️  Database not connected - some features may not work');
      console.log('🔧 Check the errors above and fix the configuration');
      console.log('='.repeat(60) + '\n');
    });
  }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', err);
  process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

startServer();

module.exports = app;
