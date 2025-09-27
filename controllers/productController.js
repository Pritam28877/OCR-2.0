const path = require('path');
const Product = require('../models/Product');
const { parseFile, validateProducts, cleanupFile } = require('../services/importService');

/**
 * Import products from a CSV or XLSX file
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const importProducts = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    const filePath = req.file.path;
    const fileExtension = path.extname(req.file.originalname).toLowerCase();

    if (fileExtension !== '.csv' && fileExtension !== '.xlsx') {
        cleanupFile(filePath);
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Only CSV and XLSX are supported.'
        });
    }

    // 1. Parse the file
    const parseResult = await parseFile(filePath);
    if (parseResult.errors.length > 0) {
        // Decide if you want to stop on parsing errors or just report them
        console.warn('Parsing errors encountered:', parseResult.errors);
    }
    
    // 2. Validate product data structure and business rules
    const validationResult = validateProducts(parseResult.products);

    // 3. Perform the database import (upserting based on a unique key e.g., catalogueId)
    const importResult = await upsertProducts(validationResult.validProducts, req.user._id);

    // 4. Cleanup the uploaded file
    cleanupFile(filePath);

    // 5. Send response
    res.status(200).json({
      success: true,
      message: 'Product import completed.',
      data: {
        parsingSummary: parseResult.summary,
        validationSummary: validationResult.summary,
        importSummary: importResult
      }
    });

  } catch (error) {
    console.error('Product import error:', error);
    if (req.file) cleanupFile(req.file.path);
    res.status(500).json({
      success: false,
      message: 'Server error during product import.',
      error: error.message
    });
  }
};

/**
 * Upsert products into the database
 * @param {Array} products - Array of valid product objects
 * @param {ObjectId} userId - The user performing the import
 * @returns {Promise<Object>} - Summary of the import operation
 */
const upsertProducts = async (products, userId) => {
    let created = 0;
    let updated = 0;
    const errors = [];

    for (const productData of products) {
        try {
            const query = { catalogueId: productData.catalogueId };
            
            // Separate fields for update and insert
            const update = {
                $set: {
                    ...productData,
                    updatedBy: userId,
                },
                $setOnInsert: {
                    createdBy: userId,
                }
            };

            const options = {
                upsert: true,
                new: true,
                setDefaultsOnInsert: true,
                runValidators: true,
            };

            const result = await Product.findOneAndUpdate(query, update, options);
            
            // Check if the document was newly created or updated
            const wasJustCreated = Math.abs(result.createdAt.getTime() - result.updatedAt.getTime()) < 2000; // 2s threshold
            if (wasJustCreated) {
                created++;
            } else {
                updated++;
            }

        } catch (error) {
            errors.push({
                catalogueId: productData.catalogueId,
                name: productData.name,
                error: error.message,
            });
        }
    }

    return {
        totalProductsInFile: products.length,
        successfullyImported: created + updated,
        created,
        updated,
        errors: errors.length,
        errorDetails: errors,
    };
};

/**
 * Get all products uploaded by the currently authenticated user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const getProductsByUser = async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const userId = req.user._id;

    const products = await Product.find({ createdBy: userId })
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Product.countDocuments({ createdBy: userId });
    const totalPages = Math.ceil(total / limit);

    res.status(200).json({
      success: true,
      message: 'User products retrieved successfully.',
      data: {
        products,
        pagination: {
          currentPage: parseInt(page),
          totalPages,
          totalProducts: total,
          hasNext: page < totalPages,
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error('Get products by user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error retrieving user products.',
      error: error.message,
    });
  }
};


module.exports = {
  importProducts,
  getProductsByUser
};
