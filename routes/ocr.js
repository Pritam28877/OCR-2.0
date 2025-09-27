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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     products:
 *                       type: array
 *                       items:
 *                         type: object
 *               example:
 *                 success: true
 *                 message: "OCR processing completed successfully"
 *                 data:
 *                   products:
 *                     - item_number: 1
 *                       product_name: "10 sq mm wire"
 *                       total_quantity: "20 Roll"
 *                       sub_quantities:
 *                         - color: "Red"
 *                           quantity: "5"
 *                         - color: "Yellow"
 *                           quantity: "5"
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
 *               - data
 *             properties:
 *               data:
 *                 type: array
 *                 items:
 *                   type: object
 *                 description: User-verified product data from OCR.
 *           example:
 *             data:
 *               - item_number: 1
 *                 product_name: "10 sq mm wire"
 *                 total_quantity: "20 Roll"
 *                 sub_quantities:
 *                   - color: "Red"
 *                     quantity: "5"
 *               - item_number: 2
 *                 product_name: "6 sq mm wire"
 *                 total_quantity: "12 Roll"
 *     responses:
 *       200:
 *         description: Product matching completed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *               example:
 *                 success: true
 *                 message: "Product matching completed successfully."
 *                 data:
 *                   - item_number: 1
 *                     product_name: "10 sq mm wire"
 *                     total_quantity: "20 Roll"
 *                     price: 2500
 *                     defaultDiscount: 5
 *                     sub_quantities:
 *                       - color: "Red"
 *                         quantity: "5"
 *                   - item_number: 2
 *                     product_name: "Unmatched Product"
 *                     total_quantity: "10 units"
 *                     price: null
 *                     defaultDiscount: null
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
