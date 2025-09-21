const { 
  getUserByPhone, 
  createCustomToken,
  admin 
} = require('../config/firebase');
const User = require('../models/User');

/**
 * @desc    Send OTP to phone number
 * @route   POST /api/auth/send-otp
 * @access  Public
 */
const sendOTP = async (req, res) => {
  try {
    const { phoneNumber } = req.body;

    // Validate phone number format (E.164)
    if (!phoneNumber || !/^\+[1-9]\d{1,14}$/.test(phoneNumber)) {
      return res.status(400).json({
        success: false,
        error: 'Valid phone number in E.164 format is required (e.g., +1234567890)',
        code: 'INVALID_PHONE_FORMAT'
      });
    }

    // Note: Firebase Client SDK handles OTP sending on the frontend
    // This endpoint is mainly for validation and user management
    
    // Check if user exists in our database
    let user = await User.findByPhone(phoneNumber);
    let isNewUser = false;

    if (!user) {
      // Check if user exists in Firebase Auth
      const firebaseUser = await getUserByPhone(phoneNumber);
      
      if (!firebaseUser) {
        isNewUser = true;
        console.log(`📱 New user registration attempt: ${phoneNumber}`);
      } else {
        // Firebase user exists but not in our DB, create DB record
        user = new User({
          firebaseUid: firebaseUser.uid,
          phoneNumber: phoneNumber
        });
        await user.save();
        console.log(`✅ Existing Firebase user added to DB: ${phoneNumber}`);
      }
    }

    // In production, you would integrate with Firebase Auth REST API or use client SDK
    // For now, we'll return success with instructions
    return res.status(200).json({
      success: true,
      message: 'OTP sending initiated. Use Firebase Client SDK to complete phone authentication.',
      data: {
        phoneNumber,
        isNewUser,
        instructions: {
          step1: 'Use Firebase Client SDK signInWithPhoneNumber() method',
          step2: 'Verify OTP using the confirmation result',
          step3: 'Send the ID token to /api/auth/verify-token endpoint'
        }
      }
    });

  } catch (error) {
    console.error('Send OTP error:', error.message);
    
    if (error.code === 'auth/user-not-found') {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to initiate OTP sending',
      code: 'OTP_SEND_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * @desc    Verify OTP and complete phone authentication
 * @route   POST /api/auth/verify-token
 * @access  Public
 */
const verifyToken = async (req, res) => {
  try {
    const { idToken, phoneNumber } = req.body;

    if (!idToken) {
      return res.status(400).json({
        success: false,
        error: 'Firebase ID token is required',
        code: 'TOKEN_REQUIRED'
      });
    }

    // Verify the Firebase ID token
    const decodedToken = await admin().auth().verifyIdToken(idToken);
    
    // Validate that the token is for phone authentication
    if (!decodedToken.phone_number) {
      return res.status(400).json({
        success: false,
        error: 'Token must be from phone authentication',
        code: 'INVALID_AUTH_METHOD'
      });
    }

    // Validate phone number matches if provided
    if (phoneNumber && decodedToken.phone_number !== phoneNumber) {
      return res.status(400).json({
        success: false,
        error: 'Phone number mismatch',
        code: 'PHONE_MISMATCH'
      });
    }

    // Find or create user in our database
    let user = await User.findByFirebaseUid(decodedToken.uid);
    let isNewUser = false;

    if (!user) {
      // Create new user
      user = new User({
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
      await user.save();
      isNewUser = true;
      console.log(`✅ New user created: ${decodedToken.phone_number}`);
    } else {
      // Update existing user login stats
      await user.updateLoginStats();
      console.log(`🔄 User login: ${decodedToken.phone_number}`);
    }

    // Create custom token with additional claims
    const customToken = await createCustomToken(decodedToken.uid, {
      role: user.role,
      phoneVerified: true
    });

    return res.status(200).json({
      success: true,
      message: isNewUser ? 'Account created successfully' : 'Login successful',
      data: {
        user: {
          uid: user.firebaseUid,
          phoneNumber: user.phoneNumber,
          name: user.profile.name,
          email: user.profile.email,
          role: user.role,
          status: user.status,
          isNewUser,
          createdAt: user.createdAt,
          lastLoginAt: user.stats.lastLoginAt
        },
        tokens: {
          idToken, // Original ID token
          customToken, // Custom token with additional claims
          expiresIn: 3600 // 1 hour
        }
      }
    });

  } catch (error) {
    console.error('Token verification error:', error.message);
    
    // Handle specific Firebase errors
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

    return res.status(500).json({
      success: false,
      error: 'Token verification failed',
      code: 'VERIFICATION_FAILED',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
};

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user || !user.dbUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    const dbUser = user.dbUser;
    
    return res.status(200).json({
      success: true,
      data: {
        user: {
          uid: dbUser.firebaseUid,
          phoneNumber: dbUser.phoneNumber,
          displayPhone: dbUser.displayPhone,
          fullName: dbUser.fullName,
          profile: dbUser.profile,
          role: dbUser.role,
          status: dbUser.status,
          preferences: dbUser.preferences,
          stats: dbUser.stats,
          createdAt: dbUser.createdAt,
          updatedAt: dbUser.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Get user profile error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to fetch user profile',
      code: 'PROFILE_FETCH_FAILED'
    });
  }
};

/**
 * @desc    Update user profile
 * @route   PUT /api/auth/profile
 * @access  Private
 */
const updateProfile = async (req, res) => {
  try {
    const user = req.user;
    const updates = req.body;

    if (!user || !user.dbUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Define allowed fields for update
    const allowedUpdates = [
      'profile.name',
      'profile.email', 
      'profile.company',
      'profile.address',
      'preferences.language',
      'preferences.timezone',
      'preferences.notifications'
    ];

    // Filter and apply updates
    const updateData = {};
    Object.keys(updates).forEach(key => {
      if (allowedUpdates.includes(key) || key.startsWith('profile.') || key.startsWith('preferences.')) {
        updateData[key] = updates[key];
      }
    });

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        error: 'No valid fields to update',
        code: 'NO_VALID_UPDATES'
      });
    }

    // Update user in database
    const updatedUser = await User.findByIdAndUpdate(
      user.dbUser._id,
      { $set: updateData },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: {
        user: {
          uid: updatedUser.firebaseUid,
          phoneNumber: updatedUser.phoneNumber,
          displayPhone: updatedUser.displayPhone,
          fullName: updatedUser.fullName,
          profile: updatedUser.profile,
          role: updatedUser.role,
          status: updatedUser.status,
          preferences: updatedUser.preferences,
          stats: updatedUser.stats,
          updatedAt: updatedUser.updatedAt
        }
      }
    });

  } catch (error) {
    console.error('Update profile error:', error.message);
    
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map(e => e.message);
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        code: 'VALIDATION_ERROR',
        details: messages
      });
    }

    return res.status(500).json({
      success: false,
      error: 'Failed to update profile',
      code: 'PROFILE_UPDATE_FAILED'
    });
  }
};

/**
 * @desc    Logout user (revoke token)
 * @route   POST /api/auth/logout
 * @access  Private
 */
const logout = async (req, res) => {
  try {
    const user = req.user;
    
    if (user && user.uid) {
      // Revoke all refresh tokens for the user
      await admin().auth().revokeRefreshTokens(user.uid);
      console.log(`🚪 User logged out: ${user.phoneNumber}`);
    }

    return res.status(200).json({
      success: true,
      message: 'Logged out successfully'
    });

  } catch (error) {
    console.error('Logout error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Logout failed',
      code: 'LOGOUT_FAILED'
    });
  }
};

/**
 * @desc    Delete user account
 * @route   DELETE /api/auth/account
 * @access  Private
 */
const deleteAccount = async (req, res) => {
  try {
    const user = req.user;
    
    if (!user || !user.dbUser) {
      return res.status(404).json({
        success: false,
        error: 'User not found',
        code: 'USER_NOT_FOUND'
      });
    }

    // Soft delete in our database
    await user.dbUser.softDelete();

    // Delete from Firebase Auth
    await admin().auth().deleteUser(user.uid);

    console.log(`🗑️ User account deleted: ${user.phoneNumber}`);

    return res.status(200).json({
      success: true,
      message: 'Account deleted successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error.message);
    return res.status(500).json({
      success: false,
      error: 'Failed to delete account',
      code: 'ACCOUNT_DELETE_FAILED'
    });
  }
};

module.exports = {
  sendOTP,
  verifyToken,
  getMe,
  updateProfile,
  logout,
  deleteAccount
};
