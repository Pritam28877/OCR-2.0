const express = require('express');
const router = express.Router();
const {
  processImage,
  getDetailedMatches,
  getProductsByCategory,
  analyzeImageQuality,
  testRawOCR,
  generateQuotationFromImage,
  validateOCRSetup
} = require('../controllers/ocrController');

const { uploadSingle } = require('../middleware/upload');
const { authenticate, authorize, optionalAuth, checkUserStatus } = require('../middleware/auth');

/**
 * @swagger
 * components:
 *   schemas:
 *     OCRProcessingResult:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *         message:
 *           type: string
 *         data:
 *           type: object
 *           properties:
 *             ocr:
 *               type: object
 *               properties:
 *                 originalText:
 *                   type: string
 *                   description: Raw text extracted from image
 *                 confidence:
 *                   type: number
 *                   description: OCR confidence score (0-1)
 *                 textLength:
 *                   type: integer
 *                 detectedLines:
 *                   type: integer
 *             processing:
 *               type: object
 *               properties:
 *                 processedItems:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ProcessedItem'
 *                 stats:
 *                   $ref: '#/components/schemas/ProcessingStats'
 *             file:
 *               type: object
 *               properties:
 *                 originalName:
 *                   type: string
 *                 size:
 *                   type: integer
 *                 imageUrl:
 *                   type: string
 *                 processedAt:
 *                   type: string
 *                   format: date-time
 *             summary:
 *               type: object
 *               properties:
 *                 totalItemsFound:
 *                   type: integer
 *                 itemsWithPrices:
 *                   type: integer
 *                 itemsRequiringReview:
 *                   type: integer
 *                 averageConfidence:
 *                   type: string
 *                 processingAccuracy:
 *                   type: string
 *     
 *     ProcessedItem:
 *       type: object
 *       properties:
 *         originalText:
 *           type: string
 *           description: Original text from OCR
 *         productText:
 *           type: string
 *           description: Cleaned product text
 *         quantity:
 *           type: integer
 *           description: Detected quantity
 *         lineNumber:
 *           type: integer
 *           description: Line number in original text
 *         bestMatch:
 *           type: object
 *           description: Best matching product (if found)
 *         price:
 *           type: number
 *           description: Product price (0 if no match)
 *         confidence:
 *           type: number
 *           description: Matching confidence (0-1)
 *         requiresReview:
 *           type: boolean
 *           description: Whether item needs manual review
 *         suggestions:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               type:
 *                 type: string
 *               message:
 *                 type: string
 *               options:
 *                 type: array
 *     
 *     ProcessingStats:
 *       type: object
 *       properties:
 *         totalItems:
 *           type: integer
 *         exactMatches:
 *           type: integer
 *         highConfidenceMatches:
 *           type: integer
 *         itemsWithPrices:
 *           type: integer
 *         itemsRequiringReview:
 *           type: integer
 *         averageConfidence:
 *           type: string
 *         processingAccuracy:
 *           type: string
 */

/**
 * @swagger
 * /api/ocr/validate:
 *   get:
 *     summary: Validate OCR system setup and configuration
 *     tags: [OCR Processing]
 *     responses:
 *       200:
 *         description: OCR system is properly configured
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 checks:
 *                   type: object
 *                   properties:
 *                     googleVisionCredentials:
 *                       type: boolean
 *                     productDatabase:
 *                       type: boolean
 *                     uploadDirectory:
 *                       type: boolean
 *                     productCount:
 *                       type: integer
 *       500:
 *         description: OCR system configuration issues
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 checks:
 *                   type: object
 *                 recommendations:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/validate', validateOCRSetup);

/**
 * @swagger
 * /api/ocr/process-image:
 *   post:
 *     summary: Process image with Google Vision OCR and match products
 *     tags: [OCR Processing]
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
 *                 description: Image file containing handwritten or printed product list (JPEG, PNG, PDF)
 *     responses:
 *       200:
 *         description: Image processed successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/OCRProcessingResult'
 *       400:
 *         description: Invalid image file or no text detected
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: OCR processing error
 */
router.post('/process-image', authenticate, checkUserStatus, uploadSingle('image'), processImage);

/**
 * @swagger
 * /api/ocr/analyze-image:
 *   post:
 *     summary: Analyze image quality for OCR suitability without processing
 *     tags: [OCR Processing]
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
 *                 description: Image file to analyze (JPEG, PNG, PDF)
 *     responses:
 *       200:
 *         description: Image quality analyzed successfully
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
 *                     fileName:
 *                       type: string
 *                     fileSize:
 *                       type: integer
 *                     analysis:
 *                       type: object
 *                       properties:
 *                         metadata:
 *                           type: object
 *                           properties:
 *                             width:
 *                               type: integer
 *                             height:
 *                               type: integer
 *                             format:
 *                               type: string
 *                             size:
 *                               type: integer
 *                         quality:
 *                           type: object
 *                           properties:
 *                             score:
 *                               type: integer
 *                               description: Quality score (0-100)
 *                             rating:
 *                               type: string
 *                               enum: [Poor, Fair, Good, Excellent]
 *                             factors:
 *                               type: array
 *                               items:
 *                                 type: string
 *                         metrics:
 *                           type: object
 *                           properties:
 *                             resolution:
 *                               type: integer
 *                             aspectRatio:
 *                               type: number
 *                             brightness:
 *                               type: number
 *                             contrast:
 *                               type: number
 *                         recommendations:
 *                           type: array
 *                           items:
 *                             type: string
 *                     recommendations:
 *                       type: object
 *                       properties:
 *                         enhancementLevel:
 *                           type: string
 *                           enum: [light, medium, strong]
 *                         ocrSuitability:
 *                           type: string
 *                         processingTips:
 *                           type: array
 *                           items:
 *                             type: string
 *       400:
 *         description: Invalid image file
 *       500:
 *         description: Image analysis error
 */
router.post('/analyze-image', authenticate, checkUserStatus, uploadSingle('image'), analyzeImageQuality);

/**
 * @swagger
 * /api/ocr/test-raw:
 *   post:
 *     summary: Test raw Google Vision OCR without preprocessing or product matching
 *     tags: [OCR Processing]
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
 *                 description: Image file to process with raw OCR (JPEG, PNG, PDF)
 *     responses:
 *       200:
 *         description: Raw OCR processing completed
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
 *                     file:
 *                       type: object
 *                       properties:
 *                         name:
 *                           type: string
 *                         size:
 *                           type: integer
 *                         sizeKB:
 *                           type: integer
 *                     ocr:
 *                       type: object
 *                       properties:
 *                         extractedText:
 *                           type: string
 *                           description: Full text extracted by Google Vision OCR
 *                         textLength:
 *                           type: integer
 *                         detectedWords:
 *                           type: integer
 *                         detectedLines:
 *                           type: integer
 *                         averageConfidence:
 *                           type: number
 *                           description: Average confidence percentage (0-100)
 *                         processingTime:
 *                           type: integer
 *                           description: Processing time in milliseconds
 *                     textByLines:
 *                       type: array
 *                       items:
 *                         type: string
 *                       description: Text split by lines for readability
 *                     wordDetails:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           word:
 *                             type: string
 *                           confidence:
 *                             type: number
 *                           boundingBox:
 *                             type: object
 *                             description: Word position in image
 *                     rawGoogleResponse:
 *                       type: object
 *                       properties:
 *                         totalDetections:
 *                           type: integer
 *                         hasFullText:
 *                           type: boolean
 *                         hasWordDetections:
 *                           type: boolean
 *       400:
 *         description: Invalid image file
 *       500:
 *         description: OCR processing error
 */
router.post('/test-raw', authenticate, checkUserStatus, uploadSingle('image'), testRawOCR);

/**
 * @swagger
 * /api/ocr/generate-quotation:
 *   post:
 *     summary: Generate quotation directly from image (End-to-End OCR + Quotation)
 *     tags: [OCR Processing]
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
 *                 description: Image file containing product list (JPEG, PNG, PDF)
 *               customerName:
 *                 type: string
 *                 description: Customer name
 *                 example: "John Doe"
 *               customerEmail:
 *                 type: string
 *                 description: Customer email
 *                 example: "john@example.com"
 *               customerPhone:
 *                 type: string
 *                 description: Customer phone number
 *                 example: "+1234567890"
 *               customerAddress:
 *                 type: string
 *                 description: Customer address
 *                 example: "123 Main St, City, State"
 *               appliedDiscount:
 *                 type: number
 *                 description: Discount amount to apply
 *                 example: 100
 *     responses:
 *       201:
 *         description: Quotation generated successfully from image
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
 *                     quotation:
 *                       $ref: '#/components/schemas/Quotation'
 *                     summary:
 *                       type: object
 *                       properties:
 *                         quotationNumber:
 *                           type: string
 *                         totalItems:
 *                           type: integer
 *                         matchedItems:
 *                           type: integer
 *                         unmatchedItems:
 *                           type: integer
 *                         matchingAccuracy:
 *                           type: string
 *                           description: Percentage of items successfully matched
 *                         totalValue:
 *                           type: number
 *                         appliedDiscount:
 *                           type: number
 *                         finalTotal:
 *                           type: number
 *                         averageConfidence:
 *                           type: string
 *                     processing:
 *                       type: object
 *                       properties:
 *                         imageQuality:
 *                           type: string
 *                         textLength:
 *                           type: integer
 *                         processingTime:
 *                           type: integer
 *                         enhancement:
 *                           type: object
 *                     recommendations:
 *                       type: object
 *                       properties:
 *                         reviewRequired:
 *                           type: boolean
 *                         unmatchedItems:
 *                           type: array
 *                           items:
 *                             type: object
 *                             properties:
 *                               originalText:
 *                                 type: string
 *                               productName:
 *                                 type: string
 *                               suggestions:
 *                                 type: array
 *       400:
 *         description: Invalid image file or no text detected
 *       500:
 *         description: Processing or quotation generation error
 */
router.post('/generate-quotation', authenticate, checkUserStatus, uploadSingle('image'), generateQuotationFromImage);

/**
 * @swagger
 * /api/ocr/get-matches:
 *   post:
 *     summary: Get detailed product matches for specific text
 *     tags: [OCR Processing]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - productText
 *             properties:
 *               productText:
 *                 type: string
 *                 description: Product text to search for
 *                 example: "Switch 6A One-way"
 *               includeCategories:
 *                 type: boolean
 *                 default: true
 *                 description: Include category-based matches
 *               includeKeywords:
 *                 type: boolean
 *                 default: true
 *                 description: Include keyword-based matches
 *     responses:
 *       200:
 *         description: Detailed matches found
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
 *                     searchText:
 *                       type: string
 *                     matches:
 *                       type: object
 *                       properties:
 *                         exactMatch:
 *                           type: object
 *                           description: Exact product match (if found)
 *                         fuzzyMatches:
 *                           type: array
 *                           description: Similar products with confidence scores
 *                         categoryMatches:
 *                           type: array
 *                           description: Products in related categories
 *                         keywordMatches:
 *                           type: array
 *                           description: Products with matching technical specs
 *                         confidence:
 *                           type: number
 *                           description: Overall matching confidence
 *                     suggestions:
 *                       type: array
 *                       description: Suggestions for manual review
 *                     searchedAt:
 *                       type: string
 *                       format: date-time
 *       400:
 *         description: Invalid search text
 *       500:
 *         description: Search processing error
 */
router.post('/get-matches', authenticate, checkUserStatus, getDetailedMatches);

/**
 * @swagger
 * /api/ocr/category-products/{category}:
 *   get:
 *     summary: Get products by category (when only category is mentioned in image)
 *     tags: [OCR Processing]
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Category name (e.g., "switches", "sockets", "lights")
 *         example: "switches"
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
 *           maximum: 50
 *           default: 20
 *         description: Number of products per page
 *     responses:
 *       200:
 *         description: Products found for category
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
 *                     category:
 *                       type: string
 *                     products:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Product'
 *                     matchedCategories:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           category:
 *                             type: string
 *                           productCount:
 *                             type: integer
 *                           matchedKeywords:
 *                             type: array
 *                             items:
 *                               type: string
 *                     pagination:
 *                       type: object
 *                       properties:
 *                         currentPage:
 *                           type: integer
 *                         totalPages:
 *                           type: integer
 *                         totalItems:
 *                           type: integer
 *                         itemsPerPage:
 *                           type: integer
 *                         hasNextPage:
 *                           type: boolean
 *                         hasPrevPage:
 *                           type: boolean
 *       404:
 *         description: No products found for category
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                 suggestions:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Category search error
 */
router.get('/category-products/:category', optionalAuth, getProductsByCategory);

module.exports = router;
