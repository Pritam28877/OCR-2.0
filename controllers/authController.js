const admin = require('../config/firebase');
const User = require('../models/User');

/**
 * Verify Firebase token and return user info
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const verifyToken = async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({
        success: false,
        message: 'Token is required'
      });
    }

    // Verify Firebase token
    const decodedToken = await admin.auth().verifyIdToken(token);

    // Find or create user in database
    let user = await User.findOne({ firebaseUid: decodedToken.uid });

    if (!user) {
      // Create new user
      user = new User({
        firebaseUid: decodedToken.uid,
        email: decodedToken.email,
        displayName: decodedToken.name,
        photoURL: decodedToken.picture,
        phoneNumber: decodedToken.phone_number
      });
      await user.save();
    } else {
      // Update last login
      user.lastLogin = new Date();
      await user.save();
    }

    res.status(200).json({
      success: true,
      message: 'Token verified successfully',
      user: {
        id: user._id,
        firebaseUid: user.firebaseUid,
        email: user.email,
        displayName: user.displayName,
        photoURL: user.photoURL,
        phoneNumber: user.phoneNumber,
        role: user.role,
        isActive: user.isActive
      }
    });

  } catch (error) {
    console.error('Token verification error:', error);
    res.status(401).json({
      success: false,
      message: 'Invalid token',
      error: error.message
    });
  }
};

/**
 * Get current user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select('-__v');

    res.status(200).json({
      success: true,
      user: user
    });

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Update user profile
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProfile = async (req, res) => {
  try {
    const { displayName, phoneNumber } = req.body;
    const userId = req.user._id;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        displayName: displayName,
        phoneNumber: phoneNumber,
        updatedAt: new Date()
      },
      { new: true, runValidators: true }
    ).select('-__v');

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUser
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Delete user account
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteAccount = async (req, res) => {
  try {
    const userId = req.user._id;

    // Soft delete - mark as inactive
    await User.findByIdAndUpdate(userId, {
      isActive: false,
      updatedAt: new Date()
    });

    res.status(200).json({
      success: true,
      message: 'Account deactivated successfully'
    });

  } catch (error) {
    console.error('Delete account error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error',
      error: error.message
    });
  }
};

/**
 * Refresh Firebase token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return res.status(400).json({
        success: false,
        message: 'Refresh token is required'
      });
    }

    // Use Firebase Admin SDK to verify and refresh token
    const decodedToken = await admin.auth().verifyIdToken(req.user.firebaseUid, true);

    res.status(200).json({
      success: true,
      message: 'Token is still valid',
      user: {
        id: req.user._id,
        firebaseUid: req.user.firebaseUid,
        email: req.user.email,
        displayName: req.user.displayName
      }
    });

  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({
      success: false,
      message: 'Token refresh failed',
      error: error.message
    });
  }
};

module.exports = {
  verifyToken,
  getProfile,
  updateProfile,
  deleteAccount,
  refreshToken
};
