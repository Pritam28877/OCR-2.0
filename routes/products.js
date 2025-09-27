const express = require('express');
const multer = require('multer');
const path = require('path');
const firebaseAuth = require('../middleware/firebaseAuth'); // Import Firebase auth
const { authorizeRoles } = require('../middleware/auth'); // Keep role authorization
const { importProducts, getProductsByUser } = require('../controllers/productController');

// Configure multer for file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/imports';
      const fs = require('fs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const extension = path.extname(file.originalname);
      cb(null, 'products-' + uniqueSuffix + extension);
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    const allowedExtensions = ['.csv', '.xlsx'];
    const fileExtension = path.extname(file.originalname).toLowerCase();
    if (allowedExtensions.includes(fileExtension)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only CSV and XLSX files are allowed.'), false);
    }
  }
});

const router = express.Router();

/**
 * @swagger
 * /api/products/import:
 *   post:
 *     summary: Import products from a CSV or XLSX file
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     consumes:
 *       - multipart/form-data
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - importFile
 *             properties:
 *               importFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV or XLSX file containing product data.
 *     responses:
 *       200:
 *         description: Product import completed successfully.
 *       400:
 *         description: Invalid file type or validation errors.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Server error during import.
 */
router.post('/import', firebaseAuth, upload.single('importFile'), importProducts);

/**
 * @swagger
 * /api/products/my-products:
 *   get:
 *     summary: Get all products uploaded by the authenticated user
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number for pagination.
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Number of items per page.
 *     responses:
 *       200:
 *         description: A list of products uploaded by the user.
 *       401:
 *         description: Unauthorized.
 *       500:
 *         description: Server error.
 */
router.get('/my-products', firebaseAuth, getProductsByUser);

module.exports = router;
