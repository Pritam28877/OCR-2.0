require('dotenv').config();
const admin = require('../config/firebase');
const User = require('../models/User');

const firebaseAuth = async (req, res, next) => {
  // --- Enhanced Debugging for Local Dev Mode ---
  console.log(`[Auth Middleware] Checking LOCAL_DEV_MODE. Value: '${process.env.LOCAL_DEV_MODE}' (Type: ${typeof process.env.LOCAL_DEV_MODE})`);

  if (process.env.LOCAL_DEV_MODE === 'true') {
    console.log('--- LOCAL DEV MODE: Bypassing Firebase Auth ---');
    // In local dev mode, bypass Firebase and attach a mock user
    let mockUser = await User.findOne({ email: 'dev@local.com' });
    if (!mockUser) {
        mockUser = new User({
            displayName: 'Local Developer',
            email: 'dev@local.com',
            roles: ['admin', 'user'],
            firebaseUid: 'local_dev_uid',
        });
        await mockUser.save();
    }
    req.user = mockUser;
    return next();
  }

  const authorizationHeader = req.headers.authorization;

  if (!authorizationHeader || !authorizationHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Unauthorized: No token provided'
    });
  }

  const idToken = authorizationHeader.split('Bearer ')[1];

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    const { uid, email, name } = decodedToken;

    // Find user in local database or create a new one
    let user = await User.findOne({ firebaseUid: uid });

    if (!user) {
      const email = decodedToken.email || `${decodedToken.phone_number || decodedToken.uid}@example.com`;
      user = new User({
        firebaseUid: uid,
        email: email,
        displayName: name || email.split('@')[0], // Fallback for display name
        phoneNumber: decodedToken.phone_number,
        password: 'managed_by_firebase', // Placeholder
        role: 'user' // Default role
      });
      await user.save();
    }

    // Attach user to the request object
    req.user = user;
    next();

  } catch (error) {
    console.error('Firebase authentication error:', error);
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
      error: error.message
    });
  }
};

module.exports = firebaseAuth;
