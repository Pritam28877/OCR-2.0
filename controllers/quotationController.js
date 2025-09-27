const Quotation = require('../models/Quotation');
const Product = require('../models/Product');
const { generateQuotationNumber, calculateTotals } = require('../services/quotationService');

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
        { 'customer.name': { $regex: search, $options: 'i' } },
        { 'customer.email': { $regex: search, $options: 'i' } }
      ];
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get quotations with pagination
    const quotations = await Quotation.find(filter)
      .populate('createdBy', 'displayName email')
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
      .populate('items.product');

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
    const { customer, items, notes, validUntil } = req.body;

    // Validate required fields
    if (!customer || !customer.name || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Customer details and a valid list of items are required'
      });
    }

    // Fetch product details for all items in parallel
    const productIds = items.map(item => item.product);
    const products = await Product.find({ '_id': { $in: productIds } });

    if (products.length !== productIds.length) {
        return res.status(400).json({ success: false, message: 'One or more products are invalid.' });
    }
    
    const productMap = new Map(products.map(p => [p._id.toString(), p]));

    const itemsWithDetails = items.map(item => {
        const product = productMap.get(item.product);
        return {
            ...item,
            product: product._id,
            productName: product.name,
            price: product.price,
            units: product.units,
            discountPercentage: item.discountPercentage || product.defaultDiscount,
            gstPercentage: product.gstPercentage,
        };
    });

    const { processedItems, subtotal, totalDiscountAmount, totalGstAmount, grandTotal } = calculateTotals(itemsWithDetails);

    const quotationNumber = await generateQuotationNumber();

    const newQuotation = new Quotation({
      quotationNumber,
      customer,
      items: processedItems,
      subtotal,
      totalDiscountAmount,
      totalGstAmount,
      grandTotal,
      notes,
      validUntil,
      createdBy: req.user._id
    });

    const savedQuotation = await newQuotation.save();

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
    const { customer, items, notes, validUntil, status } = req.body;

    const quotation = await Quotation.findById(id);

    if (!quotation) {
        return res.status(404).json({ success: false, message: 'Quotation not found' });
    }

    // Update fields
    if (customer) quotation.customer = { ...quotation.customer, ...customer };
    if (notes) quotation.notes = notes;
    if (validUntil) quotation.validUntil = validUntil;
    if (status) quotation.status = status;

    // Recalculate totals if items are updated
    if (items && Array.isArray(items)) {
      const productIds = items.map(item => item.product);
      const products = await Product.find({ '_id': { $in: productIds } });
      const productMap = new Map(products.map(p => [p._id.toString(), p]));

      const itemsWithDetails = items.map(item => {
          const product = productMap.get(item.product.toString());
          return {
              ...item,
              product: product._id,
              productName: product.name,
              price: product.price,
              units: product.units,
              discountPercentage: item.discountPercentage || product.defaultDiscount,
              gstPercentage: product.gstPercentage,
          };
      });

      const { processedItems, subtotal, totalDiscountAmount, totalGstAmount, grandTotal } = calculateTotals(itemsWithDetails);
      quotation.items = processedItems;
      quotation.subtotal = subtotal;
      quotation.totalDiscountAmount = totalDiscountAmount;
      quotation.totalGstAmount = totalGstAmount;
      quotation.grandTotal = grandTotal;
    }

    const updatedQuotation = await quotation.save();

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
