const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin SDK
const initializeFirebase = () => {
  try {
    // Check if Firebase app is already initialized
    if (admin.apps.length === 0) {
      const serviceAccount = require('../../auth.json');
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
      
      console.log('🔥 Firebase Admin SDK initialized successfully');
    }
    
    return admin;
  } catch (error) {
    console.error('❌ Firebase initialization failed:', error.message);
    throw new Error('Firebase initialization failed');
  }
};

// Get Firebase Admin instance
const getFirebaseAdmin = () => {
  if (admin.apps.length === 0) {
    return initializeFirebase();
  }
  return admin;
};

// Verify Firebase ID token
const verifyIdToken = async (idToken) => {
  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('Token verification failed:', error.message);
    throw new Error('Invalid or expired token');
  }
};

// Get user by phone number
const getUserByPhone = async (phoneNumber) => {
  try {
    const userRecord = await admin.auth().getUserByPhoneNumber(phoneNumber);
    return userRecord;
  } catch (error) {
    if (error.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
};

// Create custom token for user
const createCustomToken = async (uid, additionalClaims = {}) => {
  try {
    const customToken = await admin.auth().createCustomToken(uid, additionalClaims);
    return customToken;
  } catch (error) {
    console.error('Custom token creation failed:', error.message);
    throw new Error('Failed to create custom token');
  }
};

// Delete user
const deleteUser = async (uid) => {
  try {
    await admin.auth().deleteUser(uid);
    return true;
  } catch (error) {
    console.error('User deletion failed:', error.message);
    throw new Error('Failed to delete user');
  }
};

// Update user phone number
const updateUser = async (uid, properties) => {
  try {
    const userRecord = await admin.auth().updateUser(uid, properties);
    return userRecord;
  } catch (error) {
    console.error('User update failed:', error.message);
    throw new Error('Failed to update user');
  }
};

module.exports = {
  initializeFirebase,
  getFirebaseAdmin,
  verifyIdToken,
  getUserByPhone,
  createCustomToken,
  deleteUser,
  updateUser,
  admin: () => getFirebaseAdmin()
};
