const { extractTextFromImage, parseOCRResponse, calculateCostEstimate } = require('../services/ocrService');
const { matchProducts, createNewProducts } = require('../services/matchingService');

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

    // Calculate cost estimate
    const costEstimate = calculateCostEstimate(ocrResult.usageMetadata);

    // Try to match products if parsing was successful
    let matchingResult = null;
    if (parsedResult.success && parsedResult.data.products) {
      matchingResult = await matchProducts(parsedResult.data.products);
    }

    res.status(200).json({
      success: true,
      message: 'OCR processing completed successfully',
      data: {
        rawText: ocrResult.text,
        parsedData: parsedResult.success ? parsedResult.data : null,
        matchingResult: matchingResult,
        costAnalysis: costEstimate,
        usageMetadata: ocrResult.usageMetadata
      }
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
    const { ocrData, createProducts, createQuotation } = req.body;
    const userId = req.user._id;

    if (!ocrData || !ocrData.products) {
      return res.status(400).json({
        success: false,
        message: 'Valid OCR data is required'
      });
    }

    let result = {
      success: true,
      message: 'OCR data processed successfully'
    };

    // Match products
    const matchingResult = await matchProducts(ocrData.products);

    if (createProducts && matchingResult.unmatchedProducts.length > 0) {
      // Create new products for unmatched items
      const createResult = await createNewProducts(matchingResult.unmatchedProducts, userId);
      result.productsCreated = createResult;
    }

    // TODO: Implement quotation creation logic
    if (createQuotation) {
      result.quotation = {
        message: 'Quotation creation not yet implemented',
        data: null
      };
    }

    result.matchingResult = matchingResult;

    res.status(200).json(result);

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
