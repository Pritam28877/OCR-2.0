const express = require('express');
const router = express.Router();
const {
  getProducts,
  getProduct,
  createProduct,
  updateProduct,
  deleteProduct,
  searchProducts,
  importProducts,
  downloadTemplate,
  getCategories,
  getProductStats
} = require('../controllers/productController');

const {
  validateProduct,
  validateProductUpdate,
  validateObjectId,
  validatePagination,
  validateSearch
} = require('../middleware/validation');

const { uploadCSV } = require('../middleware/upload');
const { authenticate, authorize, optionalAuth, checkUserStatus } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     Product:
 *       type: object
 *       required:
 *         - name
 *         - sku
 *         - price
 *       properties:
 *         _id:
 *           type: string
 *           description: Product ID
 *         name:
 *           type: string
 *           maxLength: 200
 *           description: Product name
 *         sku:
 *           type: string
 *           maxLength: 50
 *           description: Stock Keeping Unit
 *         description:
 *           type: string
 *           maxLength: 1000
 *           description: Product description
 *         categories:
 *           type: array
 *           items:
 *             type: string
 *           description: Product categories
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Product price
 *         isActive:
 *           type: boolean
 *           description: Whether product is active
 *         lastUpdated:
 *           type: string
 *           format: date-time
 *           description: Last update timestamp
 *         metadata:
 *           type: object
 *           description: Additional product metadata
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         _id: "60d0fe4f5311236168a109ca"
 *         name: "Wireless Headphones"
 *         sku: "WH-001"
 *         description: "High-quality wireless headphones with noise cancellation"
 *         categories: ["Electronics", "Audio"]
 *         price: 199.99
 *         isActive: true
 *         lastUpdated: "2023-01-01T00:00:00.000Z"
 *         metadata: {}
 *         createdAt: "2023-01-01T00:00:00.000Z"
 *         updatedAt: "2023-01-01T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/products:
 *   get:
 *     summary: Get all products with pagination and filtering
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *       - in: query
 *         name: category
 *         schema:
 *           type: string
 *         description: Filter by category
 *       - in: query
 *         name: minPrice
 *         schema:
 *           type: number
 *         description: Minimum price filter
 *       - in: query
 *         name: maxPrice
 *         schema:
 *           type: number
 *         description: Maximum price filter
 *     responses:
 *       200:
 *         description: List of products retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Product'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     currentPage:
 *                       type: integer
 *                     totalPages:
 *                       type: integer
 *                     totalItems:
 *                       type: integer
 *                     itemsPerPage:
 *                       type: integer
 *                     hasNextPage:
 *                       type: boolean
 *                     hasPrevPage:
 *                       type: boolean
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Server error
 */
router.get('/', optionalAuth, validatePagination, getProducts);

/**
 * @swagger
 * /api/products/search:
 *   get:
 *     summary: Search products by name, description, or SKU
 *     tags: [Products]
 *     parameters:
 *       - in: query
 *         name: query
 *         required: true
 *         schema:
 *           type: string
 *           minLength: 2
 *           maxLength: 100
 *         description: Search query
 *       - in: query
 *         name: fuzzy
 *         schema:
 *           type: boolean
 *           default: false
 *         description: Enable fuzzy matching
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           minimum: 1
 *           default: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           minimum: 1
 *           maximum: 100
 *           default: 10
 *         description: Number of items per page
 *     responses:
 *       200:
 *         description: Search results retrieved successfully
 *       400:
 *         description: Invalid search parameters
 *       500:
 *         description: Server error
 */
router.get('/search', optionalAuth, validateSearch, validatePagination, searchProducts);

/**
 * @swagger
 * /api/products/categories:
 *   get:
 *     summary: Get all product categories with counts
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Categories retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       name:
 *                         type: string
 *                       count:
 *                         type: integer
 *       500:
 *         description: Server error
 */
router.get('/categories', optionalAuth, getCategories);

/**
 * @swagger
 * /api/products/stats:
 *   get:
 *     summary: Get product statistics
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: Statistics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalProducts:
 *                       type: integer
 *                     averagePrice:
 *                       type: number
 *                     minPrice:
 *                       type: number
 *                     maxPrice:
 *                       type: number
 *                     totalCategories:
 *                       type: integer
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, checkUserStatus, getProductStats);

/**
 * @swagger
 * /api/products/template:
 *   get:
 *     summary: Download CSV template for product import
 *     tags: [Products]
 *     responses:
 *       200:
 *         description: CSV template downloaded successfully
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *       500:
 *         description: Server error
 */
router.get('/template', downloadTemplate);

/**
 * @swagger
 * /api/products/import:
 *   post:
 *     summary: Import products from CSV file
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *                 description: CSV file containing product data
 *     responses:
 *       200:
 *         description: Products imported successfully
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
 *                     totalRows:
 *                       type: integer
 *                     validRows:
 *                       type: integer
 *                     invalidRows:
 *                       type: integer
 *                     imported:
 *                       type: integer
 *                     updated:
 *                       type: integer
 *                     skipped:
 *                       type: integer
 *                     errors:
 *                       type: array
 *                     importErrors:
 *                       type: array
 *       400:
 *         description: Invalid CSV file or structure
 *       500:
 *         description: Server error
 */
router.post('/import', authenticate, checkUserStatus, authorize(['admin', 'manager']), uploadCSV, importProducts);

/**
 * @swagger
 * /api/products/{id}:
 *   get:
 *     summary: Get single product by ID
 *     tags: [Products]
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/Product'
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.get('/:id', optionalAuth, validateObjectId('id'), getProduct);

/**
 * @swagger
 * /api/products:
 *   post:
 *     summary: Create new product
 *     tags: [Products]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - sku
 *               - price
 *             properties:
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               sku:
 *                 type: string
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               metadata:
 *                 type: object
 *     responses:
 *       201:
 *         description: Product created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, checkUserStatus, authorize(['admin', 'manager']), validateProduct, createProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   put:
 *     summary: Update product
 *     tags: [Products]
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
 *               name:
 *                 type: string
 *                 maxLength: 200
 *               sku:
 *                 type: string
 *                 maxLength: 50
 *               description:
 *                 type: string
 *                 maxLength: 1000
 *               categories:
 *                 type: array
 *                 items:
 *                   type: string
 *               price:
 *                 type: number
 *                 minimum: 0
 *               metadata:
 *                 type: object
 *     responses:
 *       200:
 *         description: Product updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Product not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticate, checkUserStatus, authorize(['admin', 'manager']), validateObjectId('id'), validateProductUpdate, updateProduct);

/**
 * @swagger
 * /api/products/{id}:
 *   delete:
 *     summary: Delete product (soft delete)
 *     tags: [Products]
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
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticate, checkUserStatus, authorize(['admin', 'manager']), validateObjectId('id'), deleteProduct);

module.exports = router;
