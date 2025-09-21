const express = require('express');
const { body, param } = require('express-validator');
const { validate } = require('../middleware/validation');
const { authenticate, authorize, checkUserStatus } = require('../middleware/auth');
const {
  sendOTP,
  verifyToken,
  getMe,
  updateProfile,
  logout,
  deleteAccount
} = require('../controllers/authController');

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AuthUser:
 *       type: object
 *       properties:
 *         uid:
 *           type: string
 *           description: Firebase UID
 *         phoneNumber:
 *           type: string
 *           description: User's phone number in E.164 format
 *         name:
 *           type: string
 *           description: User's full name
 *         email:
 *           type: string
 *           description: User's email address
 *         role:
 *           type: string
 *           enum: [user, admin, manager]
 *           description: User role
 *         status:
 *           type: string
 *           enum: [active, suspended, pending]
 *           description: Account status
 *         isNewUser:
 *           type: boolean
 *           description: Whether this is a new user registration
 *         createdAt:
 *           type: string
 *           format: date-time
 *         lastLoginAt:
 *           type: string
 *           format: date-time
 *     
 *     UserProfile:
 *       type: object
 *       properties:
 *         uid:
 *           type: string
 *         phoneNumber:
 *           type: string
 *         displayPhone:
 *           type: string
 *         fullName:
 *           type: string
 *         profile:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             company:
 *               type: string
 *             address:
 *               type: object
 *         role:
 *           type: string
 *         status:
 *           type: string
 *         preferences:
 *           type: object
 *         stats:
 *           type: object
 *   
 *   securitySchemes:
 *     BearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *       description: Firebase ID Token
 */

/**
 * @swagger
 * /api/auth/send-otp:
 *   post:
 *     summary: Initiate phone number authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phoneNumber
 *             properties:
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number in E.164 format
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: OTP sending initiated successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     phoneNumber:
 *                       type: string
 *                     isNewUser:
 *                       type: boolean
 *                     instructions:
 *                       type: object
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/send-otp', [
  body('phoneNumber')
    .notEmpty()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format (e.g., +1234567890)'),
  validate
], sendOTP);

/**
 * @swagger
 * /api/auth/verify-token:
 *   post:
 *     summary: Verify Firebase ID token and complete authentication
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - idToken
 *             properties:
 *               idToken:
 *                 type: string
 *                 description: Firebase ID Token from phone authentication
 *               phoneNumber:
 *                 type: string
 *                 description: Phone number for validation (optional)
 *                 example: "+1234567890"
 *     responses:
 *       200:
 *         description: Authentication successful
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/AuthUser'
 *                     tokens:
 *                       type: object
 *                       properties:
 *                         idToken:
 *                           type: string
 *                         customToken:
 *                           type: string
 *                         expiresIn:
 *                           type: number
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/verify-token', [
  body('idToken')
    .notEmpty()
    .withMessage('Firebase ID token is required'),
  body('phoneNumber')
    .optional()
    .matches(/^\+[1-9]\d{1,14}$/)
    .withMessage('Phone number must be in E.164 format'),
  validate
], verifyToken);

/**
 * @swagger
 * /api/auth/me:
 *   get:
 *     summary: Get current user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: User profile retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 */
router.get('/me', authenticate, checkUserStatus, getMe);

/**
 * @swagger
 * /api/auth/profile:
 *   put:
 *     summary: Update user profile
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               profile.name:
 *                 type: string
 *                 maxLength: 100
 *               profile.email:
 *                 type: string
 *                 format: email
 *               profile.company:
 *                 type: string
 *                 maxLength: 200
 *               profile.address:
 *                 type: object
 *                 properties:
 *                   street:
 *                     type: string
 *                   city:
 *                     type: string
 *                   state:
 *                     type: string
 *                   country:
 *                     type: string
 *                   postalCode:
 *                     type: string
 *               preferences.language:
 *                 type: string
 *                 enum: [en, es, fr, de, it, pt, hi, zh, ja, ko]
 *               preferences.timezone:
 *                 type: string
 *               preferences.notifications:
 *                 type: object
 *                 properties:
 *                   email:
 *                     type: boolean
 *                   sms:
 *                     type: boolean
 *                   quotationUpdates:
 *                     type: boolean
 *                   productUpdates:
 *                     type: boolean
 *     responses:
 *       200:
 *         description: Profile updated successfully
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
 *                 data:
 *                   type: object
 *                   properties:
 *                     user:
 *                       $ref: '#/components/schemas/UserProfile'
 *       400:
 *         $ref: '#/components/responses/BadRequest'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 */
router.put('/profile', [
  authenticate,
  checkUserStatus,
  body('profile.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Name cannot exceed 100 characters'),
  body('profile.email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email address'),
  body('profile.company')
    .optional()
    .trim()
    .isLength({ max: 200 })
    .withMessage('Company name cannot exceed 200 characters'),
  body('preferences.language')
    .optional()
    .isIn(['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'zh', 'ja', 'ko'])
    .withMessage('Invalid language selection'),
  validate
], updateProfile);

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: Logout user (revoke refresh tokens)
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logged out successfully
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
 *                   example: "Logged out successfully"
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.post('/logout', authenticate, logout);

/**
 * @swagger
 * /api/auth/account:
 *   delete:
 *     summary: Delete user account
 *     tags: [Authentication]
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
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
 *                   example: "Account deleted successfully"
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       404:
 *         $ref: '#/components/responses/NotFound'
 *       500:
 *         $ref: '#/components/responses/InternalServerError'
 */
router.delete('/account', authenticate, checkUserStatus, deleteAccount);

module.exports = router;
