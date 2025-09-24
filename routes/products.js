const express = require('express');
const multer = require('multer');
const firebaseAuth = require('../middleware/firebaseAuth'); // Import Firebase auth
const { authorizeRoles } = require('../middleware/auth'); // Keep role authorization
const {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getProductStats,
  importProductsFromCSV,
  downloadCSVTemplate,
  getCSVImportHistory
} = require('../controllers/productController');

// Configure multer for CSV file uploads
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      const uploadDir = 'uploads/csv';
      // Create directory if it doesn't exist
      const fs = require('fs');
      if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
      }
      cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      cb(null, 'products-' + uniqueSuffix + '.csv');
    }
  }),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    if (file.mimetype === 'text/csv' ||
        file.originalname.toLowerCase().endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

const router = express.Router();

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
 * /api/products:
 *   get:
 *     summary: Get all products with pagination and filtering
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Items per page
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for product name or description
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, productName, price, itemNumber]
 *           default: createdAt
 *         description: Sort field
 *       - in: query
 *         name: sortOrder
 *         schema:
 *           type: string
 *           enum: [asc, desc]
 *           default: desc
 *         description: Sort order
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', firebaseAuth, getAllProducts);

/**
 * @swagger
 * /api/products/stats:
 *   get:
 *     summary: Get product statistics
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Product statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', firebaseAuth, getProductStats);

/**
 * @swagger
 * /api/products/category/{category}:
 *   get:
 *     summary: Get products by category
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Product category
 *     responses:
 *       200:
 *         description: Products retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/category/:category', firebaseAuth, getProductsByCategory);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get product by ID
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product retrieved successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', firebaseAuth, getProductById);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - itemNumber
 *               - productName
 *               - totalQuantity
 *             properties:
 *               itemNumber:
 *                 type: number
 *                 description: Unique item number
 *               productName:
 *                 type: string
 *                 description: Product name
 *               totalQuantity:
 *                 type: string
 *                 description: Total quantity
 *               subQuantities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     color:
 *                       type: string
 *                     quantity:
 *                       type: string
 *               category:
 *                 type: string
 *                 description: Product category
 *               price:
 *                 type: number
 *                 description: Product price
 *               description:
 *                 type: string
 *                 description: Product description
 *               imageUrl:
 *                 type: string
 *                 description: Product image URL
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Invalid input or product already exists
 *       401:
 *         description: Unauthorized
 */
router.post('/', firebaseAuth, authorizeRoles('admin'), createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               productName:
 *                 type: string
 *               totalQuantity:
 *                 type: string
 *               subQuantities:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     color:
 *                       type: string
 *                     quantity:
 *                       type: string
 *               category:
 *                 type: string
 *               price:
 *                 type: number
 *               description:
 *                 type: string
 *               imageUrl:
 *                 type: string
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.put('/:id', firebaseAuth, authorizeRoles('admin'), updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (soft delete)
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Product ID
 *     responses:
 *       200:
 *         description: Product deleted successfully
 *       404:
 *         description: Product not found
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden - Admin access required
 */
router.delete('/:id', firebaseAuth, authorizeRoles('admin'), deleteProduct);

/**
 * @swagger
 * /api/products/import/csv:
 *   post:
 *     summary: Import products from CSV file
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: skipDuplicates
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Skip products that already exist
 *       - in: query
 *         name: updateExisting
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Update existing products instead of skipping
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - csvFile
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing product data
 *     responses:
 *       200:
 *         description: CSV import completed successfully
 *       400:
 *         description: Invalid CSV file or validation errors
 *       401:
 *         description: Unauthorized
 *       500:
 *         description: Server error during CSV import
 */
router.post('/import/csv', upload.single('csvFile'), importProductsFromCSV);

/**
 * @swagger
 * /api/products/import/template:
 *   get:
 *     summary: Download CSV template for product import
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV template downloaded successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               format: binary
 *       401:
 *         description: Unauthorized
 */
router.get('/import/template', firebaseAuth, downloadCSVTemplate);

/**
 * @swagger
 * /api/products/import/history:
 *   get:
 *     summary: Get CSV import history
 *     tags: [Products]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV import history retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/import/history', firebaseAuth, getCSVImportHistory);

module.exports = router;
