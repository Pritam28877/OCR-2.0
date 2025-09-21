const vision = require('@google-cloud/vision');
const Fuse = require('fuse.js');
const Product = require('../models/Product');

class OCRProcessor {
  constructor() {
    this.client = new vision.ImageAnnotatorClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID
    });
  }

  /**
   * Extract text from image using Google Vision API
   * @param {string} imagePath - Path to the image file
   * @returns {Object} - Extracted text and confidence
   */
  async extractTextFromImage(imagePath) {
    try {
      const [result] = await this.client.textDetection(imagePath);
      const detections = result.textAnnotations;

      if (!detections || detections.length === 0) {
        return {
          text: '',
          confidence: 0,
          error: 'No text detected in image'
        };
      }

      const fullText = detections[0].description;
      const confidence = this.calculateAverageConfidence(detections);

      return {
        text: fullText,
        confidence: confidence,
        rawDetections: detections
      };
    } catch (error) {
      console.error('OCR processing error:', error);
      throw new Error(`OCR processing failed: ${error.message}`);
    }
  }

  /**
   * Calculate average confidence from detections
   * @param {Array} detections - Google Vision API detections
   * @returns {number} - Average confidence score
   */
  calculateAverageConfidence(detections) {
    if (!detections || detections.length <= 1) return 0;

    // Skip the first detection (full text) and calculate average
    const confidences = detections.slice(1)
      .filter(detection => detection.confidence !== undefined)
      .map(detection => detection.confidence);

    if (confidences.length === 0) return 0;

    return confidences.reduce((sum, conf) => sum + conf, 0) / confidences.length;
  }

  /**
   * Parse structured data from extracted text
   * @param {string} text - Extracted text from OCR
   * @returns {Array} - Parsed product items
   */
  parseProductList(text) {
    const lines = text.split('\n').filter(line => line.trim().length > 0);
    const items = [];

    // Common patterns for product lists
    const patterns = [
      // Pattern: "Product Name - $Price x Quantity"
      /^(.+?)\s*[-–]\s*\$?(\d+(?:\.\d{2})?)\s*x?\s*(\d+)?/i,
      // Pattern: "Quantity x Product Name - $Price"
      /^(\d+)\s*x\s*(.+?)\s*[-–]\s*\$?(\d+(?:\.\d{2})?)/i,
      // Pattern: "Product Name $Price Qty: Quantity"
      /^(.+?)\s*\$?(\d+(?:\.\d{2})?)\s*(?:qty|quantity):\s*(\d+)/i,
      // Pattern: "Product Name Price Quantity"
      /^(.+?)\s+(\d+(?:\.\d{2})?)\s+(\d+)$/i
    ];

    for (const line of lines) {
      let matched = false;

      for (const pattern of patterns) {
        const match = line.match(pattern);
        if (match) {
          let productName, price, quantity;

          // Different patterns have different group orders
          if (pattern.source.startsWith('^(\\d+)')) {
            // Pattern 2: quantity first
            quantity = parseInt(match[1]);
            productName = match[2].trim();
            price = parseFloat(match[3]);
          } else {
            // Patterns 1, 3, 4: product name first
            productName = match[1].trim();
            price = parseFloat(match[2]);
            quantity = match[3] ? parseInt(match[3]) : 1;
          }

          if (productName && price && quantity) {
            items.push({
              productName: this.cleanProductName(productName),
              price: price,
              quantity: quantity,
              originalText: line.trim(),
              matchedByOCR: true
            });
            matched = true;
            break;
          }
        }
      }

      // If no pattern matched, try to extract product name only
      if (!matched && line.trim().length > 2) {
        const cleanName = this.cleanProductName(line.trim());
        if (cleanName.length > 2) {
          items.push({
            productName: cleanName,
            price: 0,
            quantity: 1,
            originalText: line.trim(),
            matchedByOCR: false,
            requiresManualEntry: true
          });
        }
      }
    }

    return items;
  }

  /**
   * Clean and normalize product name
   * @param {string} name - Raw product name
   * @returns {string} - Cleaned product name
   */
  cleanProductName(name) {
    return name
      .replace(/[^\w\s-]/g, '') // Remove special characters except hyphens
      .replace(/\s+/g, ' ') // Normalize whitespace
      .trim()
      .toLowerCase();
  }

  /**
   * Match parsed items with products in database
   * @param {Array} parsedItems - Items parsed from OCR
   * @returns {Array} - Items with matched product information
   */
  async matchProductsInDatabase(parsedItems) {
    try {
      // Get all products from database
      const allProducts = await Product.find({ isActive: true }).lean();
      
      if (allProducts.length === 0) {
        return parsedItems.map(item => ({
          ...item,
          matchedProduct: null,
          confidence: 0,
          suggestions: []
        }));
      }

      // Configure Fuse.js for fuzzy matching
      const fuse = new Fuse(allProducts, {
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'sku', weight: 0.2 },
          { name: 'description', weight: 0.1 }
        ],
        threshold: 0.4, // Similarity threshold (0 = exact match, 1 = match anything)
        includeScore: true,
        minMatchCharLength: 2
      });

      const matchedItems = [];

      for (const item of parsedItems) {
        const searchResults = fuse.search(item.productName);
        
        let matchedProduct = null;
        let confidence = 0;
        let suggestions = [];

        if (searchResults.length > 0) {
          // Best match
          const bestMatch = searchResults[0];
          matchedProduct = bestMatch.item;
          confidence = 1 - bestMatch.score; // Convert Fuse score to confidence

          // Get top 3 suggestions
          suggestions = searchResults.slice(0, 3).map(result => ({
            product: result.item,
            confidence: 1 - result.score,
            score: result.score
          }));

          // Use matched product price if OCR didn't detect price
          if (item.price === 0 && matchedProduct) {
            item.price = matchedProduct.price;
          }
        }

        matchedItems.push({
          ...item,
          matchedProduct,
          confidence,
          suggestions,
          productId: matchedProduct ? matchedProduct._id : null
        });
      }

      return matchedItems;
    } catch (error) {
      console.error('Product matching error:', error);
      throw new Error(`Product matching failed: ${error.message}`);
    }
  }

  /**
   * Process complete OCR workflow
   * @param {string} imagePath - Path to uploaded image
   * @returns {Object} - Complete OCR processing result
   */
  async processImage(imagePath) {
    try {
      // Step 1: Extract text from image
      const ocrResult = await this.extractTextFromImage(imagePath);
      
      if (!ocrResult.text) {
        return {
          success: false,
          error: 'No text detected in image',
          ocrResult
        };
      }

      // Step 2: Parse product list from text
      const parsedItems = this.parseProductList(ocrResult.text);

      if (parsedItems.length === 0) {
        return {
          success: false,
          error: 'No product items could be parsed from the text',
          ocrResult,
          rawText: ocrResult.text
        };
      }

      // Step 3: Match products with database
      const matchedItems = await this.matchProductsInDatabase(parsedItems);

      // Step 4: Calculate statistics
      const stats = this.calculateProcessingStats(matchedItems);

      return {
        success: true,
        ocrResult: {
          originalText: ocrResult.text,
          confidence: ocrResult.confidence
        },
        items: matchedItems,
        stats,
        processedAt: new Date()
      };
    } catch (error) {
      console.error('Complete OCR processing error:', error);
      throw error;
    }
  }

  /**
   * Calculate processing statistics
   * @param {Array} items - Processed items
   * @returns {Object} - Processing statistics
   */
  calculateProcessingStats(items) {
    const total = items.length;
    const matched = items.filter(item => item.matchedProduct).length;
    const highConfidence = items.filter(item => item.confidence > 0.8).length;
    const requiresReview = items.filter(item => 
      !item.matchedProduct || item.confidence < 0.6 || item.requiresManualEntry
    ).length;

    return {
      totalItems: total,
      matchedItems: matched,
      unmatchedItems: total - matched,
      highConfidenceMatches: highConfidence,
      itemsRequiringReview: requiresReview,
      matchingAccuracy: total > 0 ? (matched / total * 100).toFixed(2) : 0
    };
  }
}

module.exports = OCRProcessor;
