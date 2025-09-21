const { verifyIdToken, getUserByPhone } = require('../config/firebase');
const User = require('../models/User');

/**
 * Middleware to authenticate requests using Firebase ID tokens
 * Supports both Authorization header and phone number verification
 */
const authenticate = async (req, res, next) => {
  try {
    let token = null;
    let user = null;

    // Extract token from Authorization header
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // If no token provided, check if authentication is disabled
    if (!token) {
      if (process.env.DISABLE_AUTH === 'true') {
        // In development mode with auth disabled, create a mock user
        req.user = {
          uid: 'dev-user',
          phoneNumber: '+1234567890',
          role: 'admin'
        };
        return next();
      }

      return res.status(401).json({
        success: false,
        error: 'Access token is required',
        code: 'NO_TOKEN'
      });
    }

    // Verify Firebase ID token
    const decodedToken = await verifyIdToken(token);
    
    // Find or create user in our database
    let dbUser = await User.findByFirebaseUid(decodedToken.uid);
    
    if (!dbUser && decodedToken.phone_number) {
      // Create new user if doesn't exist
      dbUser = new User({
        firebaseUid: decodedToken.uid,
        phoneNumber: decodedToken.phone_number,
        profile: {
          name: decodedToken.name || null,
          email: decodedToken.email || null
        },
        stats: {
          lastLoginAt: new Date(),
          loginCount: 1
        }
      });
      await dbUser.save();
      console.log(`✅ New user created: ${decodedToken.phone_number}`);
    } else if (dbUser) {
      // Update login statistics
      await dbUser.updateLoginStats();
    }

    // Attach user information to request
    req.user = {
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      email: decodedToken.email,
      name: decodedToken.name,
      firebase: decodedToken,
      dbUser: dbUser
    };

    next();

  } catch (error) {
    console.error('Authentication error:', error.message);
    
    // Handle specific Firebase Auth errors
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        error: 'Token has expired',
        code: 'TOKEN_EXPIRED'
      });
    }
    
    if (error.code === 'auth/id-token-revoked') {
      return res.status(401).json({
        success: false,
        error: 'Token has been revoked',
        code: 'TOKEN_REVOKED'
      });
    }
    
    if (error.code === 'auth/invalid-id-token') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token format',
        code: 'INVALID_TOKEN'
      });
    }

    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
      code: 'AUTH_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * Middleware to check if user has required role
 * @param {string|Array} roles - Required role(s) 
 */
const authorize = (roles = []) => {
  if (typeof roles === 'string') {
    roles = [roles];
  }

  return async (req, res, next) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
          code: 'AUTH_REQUIRED'
        });
      }

      // Skip authorization if auth is disabled
      if (process.env.DISABLE_AUTH === 'true') {
        return next();
      }

      const userRole = req.user.dbUser?.role || 'user';
      
      // Check if user has required role
      if (roles.length > 0 && !roles.includes(userRole)) {
        return res.status(403).json({
          success: false,
          error: 'Insufficient permissions',
          code: 'INSUFFICIENT_PERMISSIONS',
          required: roles,
          current: userRole
        });
      }

      next();

    } catch (error) {
      console.error('Authorization error:', error.message);
      return res.status(500).json({
        success: false,
        error: 'Authorization check failed',
        code: 'AUTH_CHECK_FAILED'
      });
    }
  };
};

/**
 * Optional authentication - doesn't fail if no token provided
 * Useful for endpoints that can work with or without authentication
 */
const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // No token provided, continue without user
      req.user = null;
      return next();
    }

    const token = authHeader.substring(7);
    const decodedToken = await verifyIdToken(token);
    
    // Find user in database
    const dbUser = await User.findByFirebaseUid(decodedToken.uid);
    
    req.user = {
      uid: decodedToken.uid,
      phoneNumber: decodedToken.phone_number,
      email: decodedToken.email,
      name: decodedToken.name,
      firebase: decodedToken,
      dbUser: dbUser
    };

    next();

  } catch (error) {
    // Log error but continue without authentication
    console.warn('Optional authentication failed:', error.message);
    req.user = null;
    next();
  }
};

/**
 * Middleware to check if user account is active
 */
const checkUserStatus = async (req, res, next) => {
  try {
    if (!req.user || !req.user.dbUser) {
      return next();
    }

    const userStatus = req.user.dbUser.status;
    
    if (userStatus === 'suspended') {
      return res.status(403).json({
        success: false,
        error: 'Account has been suspended',
        code: 'ACCOUNT_SUSPENDED'
      });
    }
    
    if (userStatus === 'pending') {
      return res.status(403).json({
        success: false,
        error: 'Account is pending approval',
        code: 'ACCOUNT_PENDING'
      });
    }

    next();

  } catch (error) {
    console.error('User status check error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to check user status',
      code: 'STATUS_CHECK_FAILED'
    });
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuth,
  checkUserStatus
};
