const Quotation = require('../models/Quotation');
const Product = require('../models/Product');
const { generateQuotationNumber, calculateQuotationTotals } = require('../services/matchingService');

/**
 * Get all quotations with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllQuotations = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      status,
      search,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = {};

    if (status) {
      filter.status = status;
    }

    if (search) {
      filter.$or = [
        { quotationNumber: { $regex: search, $options: 'i' } },
        { customerName: { $regex: search, $options: 'i' } },
        { customerEmail: { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get quotations with pagination
    const quotations = await Quotation.find(filter)
      .populate('createdBy', 'displayName email')
      .populate('items.product', 'productName itemNumber')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    // Get total count for pagination
    const total = await Quotation.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: 'Quotations retrieved successfully',
      data: {
        quotations: quotations,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalQuotations: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get quotations error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving quotations',
      error: error.message
    });
  }
};

/**
 * Get quotation by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getQuotationById = async (req, res) => {
  try {
    const { id } = req.params;

    const quotation = await Quotation.findById(id)
      .populate('createdBy', 'displayName email')
      .populate('items.product', 'productName itemNumber category price');

    if (!quotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation retrieved successfully',
      data: quotation
    });

  } catch (error) {
    console.error('Get quotation by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving quotation',
      error: error.message
    });
  }
};

/**
 * Create new quotation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createQuotation = async (req, res) => {
  try {
    const {
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items,
      taxRate = 0,
      discountAmount = 0,
      notes,
      validUntil
    } = req.body;

    // Validate required fields
    if (!customerName || !customerEmail || !items || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer name, email, and items are required'
      });
    }

    // Validate products exist and get their details
    const productIds = items.map(item => item.product);
    const products = await Product.find({
      _id: { $in: productIds },
      isActive: true
    });

    if (products.length !== productIds.length) {
      return res.status(400).json({
        success: false,
        message: 'One or more products not found'
      });
    }

    // Calculate totals
    const totals = calculateQuotationTotals(items, taxRate, discountAmount);

    // Generate quotation number
    const quotationNumber = generateQuotationNumber();

    const newQuotation = new Quotation({
      quotationNumber,
      customerName,
      customerEmail,
      customerPhone,
      customerAddress,
      items,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      discountAmount,
      totalAmount: totals.totalAmount,
      notes,
      validUntil,
      createdBy: req.user._id
    });

    const savedQuotation = await newQuotation.save();

    await savedQuotation.populate('createdBy', 'displayName email');
    await savedQuotation.populate('items.product', 'productName itemNumber category price');

    res.status(201).json({
      success: true,
      message: 'Quotation created successfully',
      data: savedQuotation
    });

  } catch (error) {
    console.error('Create quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating quotation',
      error: error.message
    });
  }
};

/**
 * Update quotation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateQuotation = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;

    // Remove fields that shouldn't be updated directly
    delete updateData.quotationNumber;
    delete updateData.createdBy;
    delete updateData.createdAt;

    // Recalculate totals if items are being updated
    if (updateData.items) {
      const totals = calculateQuotationTotals(
        updateData.items,
        updateData.taxRate || 0,
        updateData.discountAmount || 0
      );
      updateData.subtotal = totals.subtotal;
      updateData.totalAmount = totals.totalAmount;
    }

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      { ...updateData, updatedAt: new Date() },
      { new: true, runValidators: true }
    ).populate('createdBy', 'displayName email')
      .populate('items.product', 'productName itemNumber category price');

    if (!updatedQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation updated successfully',
      data: updatedQuotation
    });

  } catch (error) {
    console.error('Update quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating quotation',
      error: error.message
    });
  }
};

/**
 * Update quotation status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateQuotationStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!status || !['draft', 'sent', 'approved', 'rejected', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: 'Valid status is required'
      });
    }

    const updatedQuotation = await Quotation.findByIdAndUpdate(
      id,
      { status, updatedAt: new Date() },
      { new: true }
    ).populate('createdBy', 'displayName email');

    if (!updatedQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: `Quotation status updated to ${status}`,
      data: updatedQuotation
    });

  } catch (error) {
    console.error('Update quotation status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating quotation status',
      error: error.message
    });
  }
};

/**
 * Delete quotation
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteQuotation = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedQuotation = await Quotation.findByIdAndDelete(id);

    if (!deletedQuotation) {
      return res.status(404).json({
        success: false,
        message: 'Quotation not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Quotation deleted successfully'
    });

  } catch (error) {
    console.error('Delete quotation error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting quotation',
      error: error.message
    });
  }
};

/**
 * Get quotation statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getQuotationStats = async (req, res) => {
  try {
    const stats = await Quotation.aggregate([
      {
        $group: {
          _id: null,
          totalQuotations: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' },
          averageValue: { $avg: '$totalAmount' },
          statusBreakdown: {
            $push: '$status'
          }
        }
      }
    ]);

    const statusStats = await Quotation.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalValue: { $sum: '$totalAmount' }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Quotation statistics retrieved successfully',
      data: {
        general: stats[0] || {
          totalQuotations: 0,
          totalValue: 0,
          averageValue: 0,
          statusBreakdown: []
        },
        statusBreakdown: statusStats
      }
    });

  } catch (error) {
    console.error('Get quotation stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving quotation statistics',
      error: error.message
    });
  }
};

module.exports = {
  getAllQuotations,
  getQuotationById,
  createQuotation,
  updateQuotation,
  updateQuotationStatus,
  deleteQuotation,
  getQuotationStats
};
