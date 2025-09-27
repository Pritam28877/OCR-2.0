const { extractTextFromImage, parseOCRResponse, calculateCostEstimate } = require('../services/ocrService');
const { matchProducts } = require('../services/matchingService');

/**
 * Process image and extract text using OCR
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processImageOCR = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No image file provided'
      });
    }

    const imageBuffer = req.file.buffer;
    const mimeType = req.file.mimetype;

    // Extract text using OCR
    const ocrResult = await extractTextFromImage(imageBuffer, mimeType);

    if (!ocrResult.success) {
      return res.status(500).json({
        success: false,
        message: 'OCR processing failed',
        error: ocrResult.error
      });
    }

    // Parse OCR response
    const parsedResult = parseOCRResponse(ocrResult.text);

    res.status(200).json({
      success: true,
      message: 'OCR processing completed successfully',
      data: parsedResult.success ? parsedResult.data : { products: [] }
    });

  } catch (error) {
    console.error('OCR processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during OCR processing',
      error: error.message
    });
  }
};

/**
 * Process OCR data and create products/quotations
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const processOCRData = async (req, res) => {
  try {
    const { data } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'A valid array of products under the "data" key is required'
      });
    }

    // Match products with the database
    const matchingResult = await matchProducts(data);

    // Create a map for easy lookup of matched products
    const matchedProductsMap = new Map();
    matchingResult.matchedProducts.forEach(match => {
      matchedProductsMap.set(match.extracted.item_number, match.matched);
    });

    // Build the response by augmenting the original data with price and discount
    const responseData = data.map(inputProduct => {
      const matchedProduct = matchedProductsMap.get(inputProduct.item_number);

      if (matchedProduct) {
        // If a match was found, add price and discount
        return {
          ...inputProduct,
          price: matchedProduct.price,
          defaultDiscount: matchedProduct.defaultDiscount,
        };
      } else {
        // If no match was found, return the original product with null values
        return {
          ...inputProduct,
          price: null,
          defaultDiscount: null,
        };
      }
    });

    res.status(200).json({
      success: true,
      message: 'Product matching completed successfully.',
      data: responseData,
    });

  } catch (error) {
    console.error('OCR data processing error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during OCR data processing',
      error: error.message
    });
  }
};

/**
 * Get OCR processing history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOCRHistory = async (req, res) => {
  try {
    // TODO: Implement OCR history storage and retrieval
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      message: 'OCR history feature not yet implemented',
      data: []
    });

  } catch (error) {
    console.error('Get OCR history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving OCR history',
      error: error.message
    });
  }
};

/**
 * Get OCR processing statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getOCRStats = async (req, res) => {
  try {
    // TODO: Implement OCR statistics tracking
    // For now, return placeholder data
    const stats = {
      totalProcessed: 0,
      successfulExtractions: 0,
      failedExtractions: 0,
      averageProcessingTime: 0,
      totalCost: 0
    };

    res.status(200).json({
      success: true,
      message: 'OCR statistics retrieved successfully',
      data: stats
    });

  } catch (error) {
    console.error('Get OCR stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving OCR statistics',
      error: error.message
    });
  }
};

module.exports = {
  processImageOCR,
  processOCRData,
  getOCRHistory,
  getOCRStats
};
