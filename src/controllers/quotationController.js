const Quotation = require('../models/Quotation');
const Product = require('../models/Product');
const OCRProcessor = require('../utils/ocrProcessor');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Get all quotations with pagination
 * @route   GET /api/quotations
 * @access  Public
 */
const getQuotations = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = {};
    
    if (req.query.status) {
      filter.status = req.query.status;
    }

    if (req.query.userId) {
      filter.userId = req.query.userId;
    }

    // Date range filter
    if (req.query.startDate || req.query.endDate) {
      filter.createdAt = {};
      if (req.query.startDate) filter.createdAt.$gte = new Date(req.query.startDate);
      if (req.query.endDate) filter.createdAt.$lte = new Date(req.query.endDate);
    }

    // Execute query with pagination
    const quotations = await Quotation.find(filter)
      .populate('items.productId', 'name sku price')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Quotation.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: quotations,
      pagination: {
        currentPage: page,
        totalPages,
        totalItems: total,
        itemsPerPage: limit,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get single quotation by ID
 * @route   GET /api/quotations/:id
 * @access  Public
 */
const getQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id)
      .populate('items.productId', 'name sku price description');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new quotation
 * @route   POST /api/quotations
 * @access  Public
 */
const createQuotation = async (req, res, next) => {
  try {
    // Validate that all referenced products exist
    const productIds = req.body.items
      .filter(item => item.productId)
      .map(item => item.productId);

    if (productIds.length > 0) {
      const existingProducts = await Product.find({
        _id: { $in: productIds },
        isActive: true
      });

      if (existingProducts.length !== productIds.length) {
        return res.status(400).json({
          success: false,
          error: 'One or more referenced products do not exist'
        });
      }
    }

    const quotation = await Quotation.create(req.body);
    
    // Populate the created quotation
    await quotation.populate('items.productId', 'name sku price description');

    res.status(201).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update quotation
 * @route   PUT /api/quotations/:id
 * @access  Public
 */
const updateQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    ).populate('items.productId', 'name sku price description');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete quotation
 * @route   DELETE /api/quotations/:id
 * @access  Public
 */
const deleteQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findByIdAndDelete(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Upload image and process with OCR
 * @route   POST /api/quotations/upload
 * @access  Public
 */
const uploadAndProcessImage = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'Image file is required'
      });
    }

    const ocrProcessor = new OCRProcessor();
    
    // Process the uploaded image
    const result = await ocrProcessor.processImage(req.file.path);

    // Keep the uploaded file for reference (don't delete immediately)
    const imageUrl = `/uploads/${path.basename(req.file.path)}`;

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error,
        details: {
          ocrResult: result.ocrResult,
          rawText: result.rawText
        }
      });
    }

    res.status(200).json({
      success: true,
      message: 'Image processed successfully',
      data: {
        ...result,
        imageUrl: imageUrl,
        fileName: req.file.originalname
      }
    });
  } catch (error) {
    // Clean up uploaded file if processing failed
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Create quotation from OCR results
 * @route   POST /api/quotations/from-ocr
 * @access  Public
 */
const createQuotationFromOCR = async (req, res, next) => {
  try {
    const { items, ocrData, customerInfo, appliedDiscount = 0 } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Items array is required and cannot be empty'
      });
    }

    // Prepare quotation data
    const quotationData = {
      items: items.map(item => ({
        productId: item.productId || null,
        productName: item.productName,
        quantity: item.quantity,
        price: item.price,
        matchedByOCR: item.matchedByOCR || false,
        manualEntry: item.manualEntry || false,
        notes: item.notes || '',
        confidence: item.confidence || 0
      })),
      appliedDiscount,
      ocrData: ocrData || {},
      customerInfo: customerInfo || {},
      status: 'draft'
    };

    const quotation = await Quotation.create(quotationData);
    
    // Populate the created quotation
    await quotation.populate('items.productId', 'name sku price description');

    res.status(201).json({
      success: true,
      message: 'Quotation created from OCR results',
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Add item to existing quotation
 * @route   POST /api/quotations/:id/items
 * @access  Public
 */
const addItemToQuotation = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    // Validate product exists if productId is provided
    if (req.body.productId) {
      const product = await Product.findById(req.body.productId);
      if (!product || !product.isActive) {
        return res.status(400).json({
          success: false,
          error: 'Referenced product does not exist or is inactive'
        });
      }
    }

    await quotation.addItem(req.body);
    await quotation.populate('items.productId', 'name sku price description');

    res.status(200).json({
      success: true,
      message: 'Item added to quotation',
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update item in quotation
 * @route   PUT /api/quotations/:id/items/:itemId
 * @access  Public
 */
const updateQuotationItem = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    await quotation.updateItem(req.params.itemId, req.body);
    await quotation.populate('items.productId', 'name sku price description');

    res.status(200).json({
      success: true,
      message: 'Quotation item updated',
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Remove item from quotation
 * @route   DELETE /api/quotations/:id/items/:itemId
 * @access  Public
 */
const removeQuotationItem = async (req, res, next) => {
  try {
    const quotation = await Quotation.findById(req.params.id);

    if (!quotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    await quotation.removeItem(req.params.itemId);
    await quotation.populate('items.productId', 'name sku price description');

    res.status(200).json({
      success: true,
      message: 'Item removed from quotation',
      data: quotation
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get quotation statistics
 * @route   GET /api/quotations/stats
 * @access  Public
 */
const getQuotationStats = async (req, res, next) => {
  try {
    const stats = await Quotation.aggregate([
      {
        $group: {
          _id: null,
          totalQuotations: { $sum: 1 },
          averageValue: { $avg: '$finalPrice' },
          totalValue: { $sum: '$finalPrice' },
          statusBreakdown: {
            $push: '$status'
          }
        }
      },
      {
        $project: {
          _id: 0,
          totalQuotations: 1,
          averageValue: { $round: ['$averageValue', 2] },
          totalValue: { $round: ['$totalValue', 2] },
          statusBreakdown: 1
        }
      }
    ]);

    // Calculate status breakdown
    const statusCounts = {};
    if (stats[0] && stats[0].statusBreakdown) {
      stats[0].statusBreakdown.forEach(status => {
        statusCounts[status] = (statusCounts[status] || 0) + 1;
      });
    }

    const result = stats[0] || {
      totalQuotations: 0,
      averageValue: 0,
      totalValue: 0
    };

    result.statusBreakdown = statusCounts;

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Duplicate quotation
 * @route   POST /api/quotations/:id/duplicate
 * @access  Public
 */
const duplicateQuotation = async (req, res, next) => {
  try {
    const originalQuotation = await Quotation.findById(req.params.id);

    if (!originalQuotation) {
      return res.status(404).json({
        success: false,
        error: 'Quotation not found'
      });
    }

    // Create new quotation data (excluding _id and quotationNumber)
    const duplicateData = {
      items: originalQuotation.items,
      appliedDiscount: originalQuotation.appliedDiscount,
      customerInfo: originalQuotation.customerInfo,
      status: 'draft'
    };

    const duplicatedQuotation = await Quotation.create(duplicateData);
    await duplicatedQuotation.populate('items.productId', 'name sku price description');

    res.status(201).json({
      success: true,
      message: 'Quotation duplicated successfully',
      data: duplicatedQuotation
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
