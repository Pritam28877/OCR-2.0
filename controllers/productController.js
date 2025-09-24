const Product = require('../models/Product');
const User = require('../models/User'); // Import User model
const { parseCSVFile, validateProducts, generateCSVTemplate, cleanupFile } = require('../services/csvImportService');

// Helper to get a fallback user ID when req.user is not available
const getFallbackUserId = async () => {
  // In a real app, you might want to fetch a specific system user
  // For this case, we'll just grab the first user we find.
  const user = await User.findOne();
  console.log('Fallback user found:', user); // Temporary log for debugging
  return user ? user._id : null;
};

/**
 * Get all products with pagination and filtering
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getAllProducts = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 10,
      search,
      category,
      sortBy = 'createdAt',
      sortOrder = 'desc'
    } = req.query;

    // Build filter object
    const filter = { isActive: true };

    if (search) {
      filter.$or = [
        { productName: { $regex: search, $options: 'i' } },
        { description: { $regex: search, $options: 'i' } }
      ];
    }

    if (category) {
      filter.category = category;
    }

    // Build sort object
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;

    // Get products with pagination
    const products = await Product.find(filter)
      .populate('createdBy', 'displayName email')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .select('-__v');

    // Get total count for pagination
    const total = await Product.countDocuments(filter);
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: 'Products retrieved successfully',
      data: {
        products: products,
        pagination: {
          currentPage: parseInt(page),
          totalPages: totalPages,
          totalProducts: total,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });

  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving products',
      error: error.message
    });
  }
};

/**
 * Get product by ID
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductById = async (req, res) => {
  try {
    const { id } = req.params;

    const product = await Product.findOne({
      _id: id,
      isActive: true
    }).populate('createdBy', 'displayName email');

    if (!product) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product retrieved successfully',
      data: product
    });

  } catch (error) {
    console.error('Get product by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving product',
      error: error.message
    });
  }
};

/**
 * Create new product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const createProduct = async (req, res) => {
  try {
    const {
      itemNumber,
      productName,
      totalQuantity,
      subQuantities,
      category,
      price,
      description,
      imageUrl
    } = req.body;

    // Check if product with same item number already exists
    const existingProduct = await Product.findOne({ itemNumber });
    if (existingProduct) {
      return res.status(400).json({
        success: false,
        message: 'Product with this item number already exists'
      });
    }

    const newProduct = new Product({
      itemNumber,
      productName,
      totalQuantity,
      subQuantities: subQuantities || [],
      category,
      price,
      description,
      imageUrl,
      createdBy: req.user ? req.user._id : await getFallbackUserId()
    });

    const savedProduct = await newProduct.save();

    await savedProduct.populate('createdBy', 'displayName email');

    res.status(201).json({
      success: true,
      message: 'Product created successfully',
      data: savedProduct
    });

  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error creating product',
      error: error.message
    });
  }
};

/**
 * Update product
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const updateProduct = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    const userId = req.user ? req.user._id : await getFallbackUserId();

    // Remove fields that shouldn't be updated directly
    delete updateData.createdBy;
    delete updateData.createdAt;

    const updatedProduct = await Product.findOneAndUpdate(
      { _id: id, isActive: true },
      { ...updateData, updatedBy: userId },
      { new: true, runValidators: true }
    ).populate('createdBy', 'displayName email').populate('updatedBy', 'displayName email');

    if (!updatedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product updated successfully',
      data: updatedProduct
    });

  } catch (error) {
    console.error('Update product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error updating product',
      error: error.message
    });
  }
};

/**
 * Delete product (soft delete)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const deleteProduct = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedProduct = await Product.findOneAndUpdate(
      { _id: id, isActive: true },
      { isActive: false, updatedAt: new Date() },
      { new: true }
    );

    if (!deletedProduct) {
      return res.status(404).json({
        success: false,
        message: 'Product not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Product deleted successfully',
      data: deletedProduct
    });

  } catch (error) {
    console.error('Delete product error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error deleting product',
      error: error.message
    });
  }
};

/**
 * Get products by category
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductsByCategory = async (req, res) => {
  try {
    const { category } = req.params;

    const products = await Product.find({
      category: category,
      isActive: true
    }).populate('createdBy', 'displayName email');

    res.status(200).json({
      success: true,
      message: `Products in category ${category} retrieved successfully`,
      data: products
    });

  } catch (error) {
    console.error('Get products by category error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving products by category',
      error: error.message
    });
  }
};

/**
 * Get product statistics
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductStats = async (req, res) => {
  try {
    const stats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          totalProducts: { $sum: 1 },
          averagePrice: { $avg: '$price' },
          categories: { $addToSet: '$category' }
        }
      }
    ]);

    const categoryStats = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: '$category',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    res.status(200).json({
      success: true,
      message: 'Product statistics retrieved successfully',
      data: {
        general: stats[0] || { totalProducts: 0, averagePrice: 0, categories: [] },
        categoryBreakdown: categoryStats
      }
    });

  } catch (error) {
    console.error('Get product stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving product statistics',
      error: error.message
    });
  }
};

/**
 * Import products from CSV file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const importProductsFromCSV = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No CSV file provided'
      });
    }

    const csvFilePath = req.file.path;
    const userId = req.user ? req.user._id : await getFallbackUserId();
    const { skipDuplicates = false, updateExisting = false } = req.query;

    // Parse CSV file
    const parseResult = await parseCSVFile(csvFilePath);

    if (parseResult.errors.length > 0) {
      cleanupFile(csvFilePath);
      return res.status(400).json({
        success: false,
        message: 'CSV parsing errors found',
        data: {
          errors: parseResult.errors,
          summary: parseResult.summary
        }
      });
    }

    // Validate products
    const validationResult = validateProducts(parseResult.products);

    if (validationResult.errors.length > 0) {
      cleanupFile(csvFilePath);
      return res.status(400).json({
        success: false,
        message: 'Product validation failed',
        data: {
          errors: validationResult.errors,
          summary: validationResult.summary
        }
      });
    }

    // Import products
    const importResults = {
      imported: [],
      skipped: [],
      updated: [],
      errors: []
    };

    for (const productData of validationResult.validProducts) {
      try {
        // Check if product already exists
        const existingProduct = await Product.findOne({ itemNumber: productData.itemNumber });

        if (existingProduct) {
          if (skipDuplicates) {
            importResults.skipped.push({
              itemNumber: productData.itemNumber,
              productName: productData.productName,
              reason: 'Product already exists (skipped)'
            });
            continue;
          } else if (updateExisting) {
            // Update existing product
            const updatedProduct = await Product.findByIdAndUpdate(
              existingProduct._id,
              {
                ...productData,
                updatedBy: userId
              },
              { new: true }
            );

            importResults.updated.push({
              itemNumber: productData.itemNumber,
              productName: productData.productName,
              productId: updatedProduct._id
            });
            continue;
          } else {
            importResults.errors.push({
              itemNumber: productData.itemNumber,
              productName: productData.productName,
              reason: 'Product already exists'
            });
            continue;
          }
        }

        // Create new product
        const newProduct = new Product({
          ...productData,
          createdBy: userId
        });

        const savedProduct = await newProduct.save();
        await savedProduct.populate('createdBy', 'displayName email');

        importResults.imported.push({
          itemNumber: productData.itemNumber,
          productName: productData.productName,
          productId: savedProduct._id
        });

      } catch (error) {
        importResults.errors.push({
          itemNumber: productData.itemNumber,
          productName: productData.productName,
          reason: error.message
        });
      }
    }

    // Clean up uploaded file
    cleanupFile(csvFilePath);

    // Calculate summary
    const summary = {
      totalProcessed: validationResult.validProducts.length,
      imported: importResults.imported.length,
      updated: importResults.updated.length,
      skipped: importResults.skipped.length,
      errors: importResults.errors.length
    };

    res.status(200).json({
      success: true,
      message: 'CSV import completed',
      data: {
        summary,
        imported: importResults.imported,
        updated: importResults.updated,
        skipped: importResults.skipped,
        errors: importResults.errors
      }
    });

  } catch (error) {
    console.error('CSV import error:', error);

    // Clean up file in case of error
    if (req.file && req.file.path) {
      cleanupFile(req.file.path);
    }

    res.status(500).json({
      success: false,
      message: 'Server error during CSV import',
      error: error.message
    });
  }
};

/**
 * Download CSV template for product import
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const downloadCSVTemplate = async (req, res) => {
  try {
    const csvTemplate = generateCSVTemplate();

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product_import_template.csv"');
    res.setHeader('Cache-Control', 'no-cache');

    res.status(200).send(csvTemplate);

  } catch (error) {
    console.error('Download CSV template error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error generating CSV template',
      error: error.message
    });
  }
};

/**
 * Get CSV import history
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getCSVImportHistory = async (req, res) => {
  try {
    // TODO: Implement import history tracking
    // For now, return a placeholder response
    res.status(200).json({
      success: true,
      message: 'CSV import history feature not yet implemented',
      data: []
    });

  } catch (error) {
    console.error('Get CSV import history error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving CSV import history',
      error: error.message
    });
  }
};

module.exports = {
  getAllProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getProductsByCategory,
  getProductStats,
  importProductsFromCSV,
  downloadCSVTemplate,
  getCSVImportHistory
};
