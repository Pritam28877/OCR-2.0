const express = require('express');
const multer = require('multer');
const { authenticateToken, optionalAuth } = require('../middleware/auth');
const {
  processImageOCR,
  processOCRData,
  getOCRHistory,
  getOCRStats
} = require('../controllers/ocrController');

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'), false);
    }
  }
});

/**
 * @swagger
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 */

/**
 * @swagger
 * /api/ocr/process:
 *   post:
 *     summary: Process image with OCR
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - image
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file to process
 *     responses:
 *       200:
 *         description: OCR processing completed successfully
 *       400:
 *         description: No image file provided
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: OCR processing failed
 */
router.post('/process', authenticateToken, upload.single('image'), processImageOCR);

/**
 * @swagger
 * /api/ocr/process-data:
 *   post:
 *     summary: Process OCR data and create products/quotations
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - ocrData
 *             properties:
 *               ocrData:
 *                 type: object
 *                 description: OCR extracted data
 *               createProducts:
 *                 type: boolean
 *                 description: Whether to create new products from unmatched data
 *               createQuotation:
 *                 type: boolean
 *                 description: Whether to create quotation from matched products
 *     responses:
 *       200:
 *         description: OCR data processed successfully
 *       400:
 *         description: Valid OCR data is required
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error during OCR data processing
 */
router.post('/process-data', authenticateToken, processOCRData);

/**
 * @swagger
 * /api/ocr/history:
 *   get:
 *     summary: Get OCR processing history
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OCR history retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/history', authenticateToken, getOCRHistory);

/**
 * @swagger
 * /api/ocr/stats:
 *   get:
 *     summary: Get OCR processing statistics
 *     tags: [OCR]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: OCR statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', authenticateToken, getOCRStats);

module.exports = router;
