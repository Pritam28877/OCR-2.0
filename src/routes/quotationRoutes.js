const express = require('express');
const router = express.Router();
const {
  getQuotations,
  getQuotation,
  createQuotation,
  updateQuotation,
  deleteQuotation,
  uploadAndProcessImage,
  createQuotationFromOCR,
  addItemToQuotation,
  updateQuotationItem,
  removeQuotationItem,
  getQuotationStats,
  duplicateQuotation
} = require('../controllers/quotationController');

const {
  validateQuotation,
  validateQuotationUpdate,
  validateObjectId,
  validatePagination
} = require('../middleware/validation');

const { uploadSingle } = require('../middleware/upload');
const { authenticate, authorize, optionalAuth, checkUserStatus } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     QuotationItem:
 *       type: object
 *       required:
 *         - productName
 *         - quantity
 *         - price
 *       properties:
 *         productId:
 *           type: string
 *           description: Reference to Product ID (optional)
 *         productName:
 *           type: string
 *           description: Product name
 *         quantity:
 *           type: integer
 *           minimum: 1
 *           description: Quantity of the product
 *         price:
 *           type: number
 *           minimum: 0
 *           description: Unit price
 *         matchedByOCR:
 *           type: boolean
 *           description: Whether item was matched by OCR
 *         manualEntry:
 *           type: boolean
 *           description: Whether item was manually entered
 *         notes:
 *           type: string
 *           maxLength: 500
 *           description: Additional notes
 *         confidence:
 *           type: number
 *           minimum: 0
 *           maximum: 1
 *           description: OCR matching confidence
 *       example:
 *         productId: "60d0fe4f5311236168a109ca"
 *         productName: "Wireless Headphones"
 *         quantity: 2
 *         price: 199.99
 *         matchedByOCR: true
 *         manualEntry: false
 *         notes: "Customer requested black color"
 *         confidence: 0.95
 *     
 *     Quotation:
 *       type: object
 *       required:
 *         - items
 *       properties:
 *         _id:
 *           type: string
 *           description: Quotation ID
 *         quotationNumber:
 *           type: string
 *           description: Unique quotation number
 *         userId:
 *           type: string
 *           description: User ID (optional)
 *         items:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/QuotationItem'
 *           description: List of quoted items
 *         totalPrice:
 *           type: number
 *           description: Total price before discount
 *         status:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *           description: Quotation status
 *         appliedDiscount:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *           description: Discount percentage
 *         discountAmount:
 *           type: number
 *           description: Calculated discount amount
 *         finalPrice:
 *           type: number
 *           description: Final price after discount
 *         ocrData:
 *           type: object
 *           properties:
 *             originalText:
 *               type: string
 *             processedAt:
 *               type: string
 *               format: date-time
 *             confidence:
 *               type: number
 *             imageUrl:
 *               type: string
 *         customerInfo:
 *           type: object
 *           properties:
 *             name:
 *               type: string
 *             email:
 *               type: string
 *             phone:
 *               type: string
 *             address:
 *               type: string
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *       example:
 *         _id: "60d0fe4f5311236168a109cb"
 *         quotationNumber: "QUO-123456-001"
 *         items:
 *           - productId: "60d0fe4f5311236168a109ca"
 *             productName: "Wireless Headphones"
 *             quantity: 2
 *             price: 199.99
 *             matchedByOCR: true
 *             manualEntry: false
 *             confidence: 0.95
 *         totalPrice: 399.98
 *         status: "draft"
 *         appliedDiscount: 10
 *         discountAmount: 39.998
 *         finalPrice: 359.982
 *         customerInfo:
 *           name: "John Doe"
 *           email: "john@example.com"
 *         createdAt: "2023-01-01T00:00:00.000Z"
 *         updatedAt: "2023-01-01T00:00:00.000Z"
 */

/**
 * @swagger
 * /api/quotations:
 *   get:
 *     summary: Get all quotations with pagination and filtering
 *     tags: [Quotations]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, pending, approved, rejected]
 *         description: Filter by status
 *       - in: query
 *         name: userId
 *         schema:
 *           type: string
 *         description: Filter by user ID
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by start date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Filter by end date
 *     responses:
 *       200:
 *         description: List of quotations retrieved successfully
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
 *                     $ref: '#/components/schemas/Quotation'
 *                 pagination:
 *                   type: object
 *       400:
 *         description: Invalid query parameters
 *       500:
 *         description: Server error
 */
router.get('/', authenticate, checkUserStatus, validatePagination, getQuotations);

/**
 * @swagger
 * /api/quotations/stats:
 *   get:
 *     summary: Get quotation statistics
 *     tags: [Quotations]
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
 *                     totalQuotations:
 *                       type: integer
 *                     averageValue:
 *                       type: number
 *                     totalValue:
 *                       type: number
 *                     statusBreakdown:
 *                       type: object
 *       500:
 *         description: Server error
 */
router.get('/stats', authenticate, checkUserStatus, getQuotationStats);

/**
 * @swagger
 * /api/quotations/upload:
 *   post:
 *     summary: Upload image and process with OCR
 *     tags: [Quotations]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Image file (JPEG, PNG, PDF)
 *     responses:
 *       200:
 *         description: Image processed successfully
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
 *                     ocrResult:
 *                       type: object
 *                       properties:
 *                         originalText:
 *                           type: string
 *                         confidence:
 *                           type: number
 *                     items:
 *                       type: array
 *                       items:
 *                         type: object
 *                     stats:
 *                       type: object
 *                     imageUrl:
 *                       type: string
 *                     fileName:
 *                       type: string
 *                     processedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid image file or processing failed
 *       500:
 *         description: Server error
 */
router.post('/upload', authenticate, checkUserStatus, uploadSingle('image'), uploadAndProcessImage);

/**
 * @swagger
 * /api/quotations/from-ocr:
 *   post:
 *     summary: Create quotation from OCR results
 *     tags: [Quotations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/QuotationItem'
 *               ocrData:
 *                 type: object
 *               customerInfo:
 *                 type: object
 *               appliedDiscount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 0
 *     responses:
 *       201:
 *         description: Quotation created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/from-ocr', authenticate, checkUserStatus, createQuotationFromOCR);

/**
 * @swagger
 * /api/quotations/{id}:
 *   get:
 *     summary: Get single quotation by ID
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     responses:
 *       200:
 *         description: Quotation retrieved successfully
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.get('/:id', authenticate, checkUserStatus, validateObjectId('id'), getQuotation);

/**
 * @swagger
 * /api/quotations:
 *   post:
 *     summary: Create new quotation
 *     tags: [Quotations]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - items
 *             properties:
 *               items:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/QuotationItem'
 *               appliedDiscount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *                 default: 0
 *               customerInfo:
 *                 type: object
 *     responses:
 *       201:
 *         description: Quotation created successfully
 *       400:
 *         description: Validation error
 *       500:
 *         description: Server error
 */
router.post('/', authenticate, checkUserStatus, validateQuotation, createQuotation);

/**
 * @swagger
 * /api/quotations/{id}:
 *   put:
 *     summary: Update quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, pending, approved, rejected]
 *               appliedDiscount:
 *                 type: number
 *                 minimum: 0
 *                 maximum: 100
 *               customerInfo:
 *                 type: object
 *     responses:
 *       200:
 *         description: Quotation updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.put('/:id', authenticate, checkUserStatus, validateObjectId('id'), validateQuotationUpdate, updateQuotation);

/**
 * @swagger
 * /api/quotations/{id}:
 *   delete:
 *     summary: Delete quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     responses:
 *       200:
 *         description: Quotation deleted successfully
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.delete('/:id', authenticate, checkUserStatus, validateObjectId('id'), deleteQuotation);

/**
 * @swagger
 * /api/quotations/{id}/duplicate:
 *   post:
 *     summary: Duplicate quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID to duplicate
 *     responses:
 *       201:
 *         description: Quotation duplicated successfully
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.post('/:id/duplicate', authenticate, checkUserStatus, validateObjectId('id'), duplicateQuotation);

/**
 * @swagger
 * /api/quotations/{id}/items:
 *   post:
 *     summary: Add item to existing quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/QuotationItem'
 *     responses:
 *       200:
 *         description: Item added successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Quotation not found
 *       500:
 *         description: Server error
 */
router.post('/:id/items', authenticate, checkUserStatus, validateObjectId('id'), addItemToQuotation);

/**
 * @swagger
 * /api/quotations/{id}/items/{itemId}:
 *   put:
 *     summary: Update item in quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               quantity:
 *                 type: integer
 *                 minimum: 1
 *               price:
 *                 type: number
 *                 minimum: 0
 *               notes:
 *                 type: string
 *                 maxLength: 500
 *     responses:
 *       200:
 *         description: Item updated successfully
 *       400:
 *         description: Validation error
 *       404:
 *         description: Quotation or item not found
 *       500:
 *         description: Server error
 */
router.put('/:id/items/:itemId', authenticate, checkUserStatus, validateObjectId('id'), updateQuotationItem);

/**
 * @swagger
 * /api/quotations/{id}/items/{itemId}:
 *   delete:
 *     summary: Remove item from quotation
 *     tags: [Quotations]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Quotation ID
 *       - in: path
 *         name: itemId
 *         required: true
 *         schema:
 *           type: string
 *         description: Item ID
 *     responses:
 *       200:
 *         description: Item removed successfully
 *       404:
 *         description: Quotation or item not found
 *       500:
 *         description: Server error
 */
router.delete('/:id/items/:itemId', authenticate, checkUserStatus, validateObjectId('id'), removeQuotationItem);

module.exports = router;
