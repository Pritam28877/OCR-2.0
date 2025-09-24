const express = require('express');
const { authenticateToken, authorizeRoles } = require('../middleware/auth');
const {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationStats
} = require('../controllers/quotationController');

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
 * /api/quotations:
 *   get:
 *     summary: Get all quotations with pagination and filtering
 *     tags: [Quotations]
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
 *         name: status
 *         schema:
 *           type: string
 *           enum: [draft, sent, approved, rejected, completed]
 *         description: Filter by status
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search term for quotation number, customer name, or email
 *       - in: query
 *         name: sortBy
 *         schema:
 *           type: string
 *           enum: [createdAt, quotationNumber, customerName, totalAmount]
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
 *         description: Quotations retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/', authenticateToken, getAllQuotations);

/**
 * @swagger
 * /api/quotations/stats:
 *   get:
 *     summary: Get quotation statistics
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Quotation statistics retrieved successfully
 *       401:
 *         description: Unauthorized
 */
router.get('/stats', authenticateToken, getQuotationStats);

/**
 * @swagger
 * /api/quotations/{id}:
 *   get:
 *     summary: Get quotation by ID
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Unauthorized
 */
router.get('/:id', authenticateToken, getQuotationById);

/**
 * @swagger
 * /api/quotations:
 *   post:
 *     summary: Create new quotation
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - customerName
 *               - customerEmail
 *               - items
 *             properties:
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *               customerEmail:
 *                 type: string
 *                 format: email
 *                 description: Customer email
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone number
 *               customerAddress:
 *                 type: string
 *                 description: Customer address
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required:
 *                     - product
 *                     - quantity
 *                     - unitPrice
 *                     - totalPrice
 *                   properties:
 *                     product:
 *                       type: string
 *                       description: Product ID
 *                     quantity:
 *                       type: string
 *                       description: Quantity
 *                     unitPrice:
 *                       type: number
 *                       description: Unit price
 *                     totalPrice:
 *                       type: number
 *                       description: Total price (quantity * unitPrice)
 *                     notes:
 *                       type: string
 *                       description: Item notes
 *               taxRate:
 *                 type: number
 *                 default: 0
 *                 description: Tax rate percentage
 *               discountAmount:
 *                 type: number
 *                 default: 0
 *                 description: Discount amount
 *               notes:
 *                 type: string
 *                 description: Quotation notes
 *               validUntil:
 *                 type: string
 *                 format: date
 *                 description: Quotation validity date
 *     responses:
 *       201:
 *         description: Quotation created successfully
 *       400:
 *         description: Invalid input or product not found
 *       401:
 *         description: Unauthorized
 */
router.post('/', authenticateToken, createQuotation);

/**
 * @swagger
 * /api/quotations/{id}:
 *   put:
 *     summary: Update quotation
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
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
 *               customerName:
 *                 type: string
 *               customerEmail:
 *                 type: string
 *                 format: email
 *               customerPhone:
 *                 type: string
 *               customerAddress:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     product:
 *                       type: string
 *                     quantity:
 *                       type: string
 *                     unitPrice:
 *                       type: number
 *                     totalPrice:
 *                       type: number
 *                     notes:
 *                       type: string
 *               taxRate:
 *                 type: number
 *               discountAmount:
 *                 type: number
 *               notes:
 *                 type: string
 *               validUntil:
 *                 type: string
 *                 format: date
 *     responses:
 *       200:
 *         description: Quotation updated successfully
 *       404:
 *         description: Quotation not found
 *       401:
 *         description: Unauthorized
 */
router.put('/:id', authenticateToken, updateQuotation);

/**
 * @swagger
 * /api/quotations/{id}/status:
 *   patch:
 *     summary: Update quotation status
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
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
 *             required:
 *               - status
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [draft, sent, approved, rejected, completed]
 *                 description: New quotation status
 *     responses:
 *       200:
 *         description: Quotation status updated successfully
 *       400:
 *         description: Valid status is required
 *       404:
 *         description: Quotation not found
 *       401:
 *         description: Unauthorized
 */
router.patch('/:id/status', authenticateToken, updateQuotationStatus);

/**
 * @swagger
 * /api/quotations/{id}:
 *   delete:
 *     summary: Delete quotation
 *     tags: [Quotations]
 *     security:
 *       - bearerAuth: []
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
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id', authenticateToken, deleteQuotation);

module.exports = router;
