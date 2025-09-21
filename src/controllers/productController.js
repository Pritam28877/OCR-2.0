const Product = require('../models/Product');
const CSVProcessor = require('../utils/csvProcessor');
const Fuse = require('fuse.js');
const fs = require('fs');
const path = require('path');

/**
 * @desc    Get all products with pagination and filtering
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = async (req, res, next) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { isActive: true };
    
    if (req.query.category) {
      filter.categories = { $in: [req.query.category] };
    }

    if (req.query.minPrice || req.query.maxPrice) {
      filter.price = {};
      if (req.query.minPrice) filter.price.$gte = parseFloat(req.query.minPrice);
      if (req.query.maxPrice) filter.price.$lte = parseFloat(req.query.maxPrice);
    }

    // Execute query with pagination
    const products = await Product.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: products,
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
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProduct = async (req, res, next) => {
  try {
    const product = await Product.findById(req.params.id);

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create new product
 * @route   POST /api/products
 * @access  Public
 */
const createProduct = async (req, res, next) => {
  try {
    const product = await Product.create(req.body);

    res.status(201).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update product
 * @route   PUT /api/products/:id
 * @access  Public
 */
const updateProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      req.body,
      {
        new: true,
        runValidators: true
      }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      data: product
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete product (soft delete)
 * @route   DELETE /api/products/:id
 * @access  Public
 */
const deleteProduct = async (req, res, next) => {
  try {
    const product = await Product.findByIdAndUpdate(
      req.params.id,
      { isActive: false },
      { new: true }
    );

    if (!product) {
      return res.status(404).json({
        success: false,
        error: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully'
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Search products by name/description
 * @route   GET /api/products/search
 * @access  Public
 */
const searchProducts = async (req, res, next) => {
  try {
    const { query, fuzzy = false } = req.query;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;

    let products;
    let total;

    if (fuzzy === 'true') {
      // Fuzzy search using Fuse.js
      const allProducts = await Product.find({ isActive: true }).lean();
      
      const fuse = new Fuse(allProducts, {
        keys: [
          { name: 'name', weight: 0.7 },
          { name: 'sku', weight: 0.2 },
          { name: 'description', weight: 0.1 }
        ],
        threshold: 0.4,
        includeScore: true
      });

      const searchResults = fuse.search(query);
      total = searchResults.length;
      
      // Apply pagination to fuzzy results
      const skip = (page - 1) * limit;
      products = searchResults
        .slice(skip, skip + limit)
        .map(result => ({
          ...result.item,
          searchScore: 1 - result.score
        }));
    } else {
      // Regular MongoDB text search
      const skip = (page - 1) * limit;
      
      products = await Product.find({
        $and: [
          { isActive: true },
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { description: { $regex: query, $options: 'i' } },
              { sku: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit)
      .lean();

      total = await Product.countDocuments({
        $and: [
          { isActive: true },
          {
            $or: [
              { name: { $regex: query, $options: 'i' } },
              { description: { $regex: query, $options: 'i' } },
              { sku: { $regex: query, $options: 'i' } }
            ]
          }
        ]
      });
    }

    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      data: products,
      searchQuery: query,
      searchType: fuzzy === 'true' ? 'fuzzy' : 'exact',
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
 * @desc    Import products from CSV file
 * @route   POST /api/products/import
 * @access  Public
 */
const importProducts = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'CSV file is required'
      });
    }

    const csvProcessor = new CSVProcessor();
    
    // Validate CSV structure first
    const validation = await csvProcessor.validateCSVStructure(req.file.path);
    
    if (!validation.hasRequiredFields) {
      // Clean up uploaded file
      fs.unlinkSync(req.file.path);
      
      return res.status(400).json({
        success: false,
        error: 'Invalid CSV structure',
        details: validation.issues
      });
    }

    // Process the CSV file
    const result = await csvProcessor.processCSVFile(req.file.path);

    // Clean up uploaded file
    fs.unlinkSync(req.file.path);

    res.status(200).json({
      success: true,
      message: 'CSV import completed',
      data: result
    });
  } catch (error) {
    // Clean up uploaded file if it exists
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    next(error);
  }
};

/**
 * @desc    Download CSV template for product import
 * @route   GET /api/products/template
 * @access  Public
 */
const downloadTemplate = async (req, res, next) => {
  try {
    const csvProcessor = new CSVProcessor();
    const template = csvProcessor.generateTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=product-import-template.csv');
    
    res.status(200).send(template);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get product categories
 * @route   GET /api/products/categories
 * @access  Public
 */
const getCategories = async (req, res, next) => {
  try {
    const categories = await Product.aggregate([
      { $match: { isActive: true } },
      { $unwind: '$categories' },
      { $group: { _id: '$categories', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { _id: 0, name: '$_id', count: 1 } }
    ]);

    res.status(200).json({
      success: true,
      data: categories
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get product statistics
 * @route   GET /api/products/stats
 * @access  Public
 */
const getProductStats = async (req, res, next) => {
  try {
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          totalCategories: { $addToSet: '$categories' }
        }
      },
      {
        $project: {
          _id: 0,
          totalProducts: 1,
          averagePrice: { $round: ['$averagePrice', 2] },
          minPrice: 1,
          maxPrice: 1,
          totalCategories: { $size: { $reduce: {
            input: '$totalCategories',
            initialValue: [],
            in: { $setUnion: ['$$value', '$$this'] }
          }}}
        }
      }
    ]);

    const result = stats[0] || {
      totalProducts: 0,
      averagePrice: 0,
      minPrice: 0,
      maxPrice: 0,
      totalCategories: 0
    };

    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    next(error);
  }
};

module.exports = {
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
};
