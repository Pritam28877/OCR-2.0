require('dotenv').config();
const admin = require('../config/firebase');
const User = require('../models/User');

const authenticateToken = async (req, res, next) => {
  if (process.env.LOCAL_DEV_MODE === 'true') {
    console.log('--- LOCAL DEV MODE: Bypassing Token Auth ---');
    let mockUser = await User.findOne({ email: 'dev@local.com' });
    if (!mockUser) {
        mockUser = new User({
            displayName: 'Local Developer',
            email: 'dev@local.com',
            role: 'admin',
            firebaseUid: 'local_dev_uid',
        });
        await mockUser.save();
    }
    req.user = mockUser;
    return next();
  }

  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. No token provided.'
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Check if Firebase is properly initialized
    if (!admin.apps.length) {
      return res.status(503).json({
        success: false,
        message: 'Authentication service temporarily unavailable. Please try again later.',
        error: 'Firebase not configured'
      });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Find or create user in database
    let user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (!user) {
      // Create user if not exists
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        role: 'user' // Assign default role
      });
      await user.save();
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      error: error.message
    });
  }
};

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (process.env.LOCAL_DEV_MODE === 'true') {
      // In local dev mode, grant all role access
      return next();
    }

    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Access denied. User not authenticated.'
      });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: `Access denied. User role '${req.user.role}' is not authorized.`
      });
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      req.user = null;
      return next();
    }

    // Check if Firebase is properly initialized
    if (!admin.apps.length) {
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(token);

    let user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (user) {
      user.lastLogin = new Date();
      await user.save();
    }

    req.user = user;
    next();
  } catch (error) {
    // If token is invalid, continue without user
    req.user = null;
    next();
  }
};

module.exports = {
  authenticateToken,
  authorizeRoles,
  optionalAuth
};
