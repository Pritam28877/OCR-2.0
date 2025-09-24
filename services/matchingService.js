const Product = require('../models/Product');

/**
 * Match OCR extracted products with database products
 * @param {Array} extractedProducts - Products from OCR
 * @returns {Promise<Object>} - Matched products and suggestions
 */
const matchProducts = async (extractedProducts) => {
  try {
    const matchedProducts = [];
    const unmatchedProducts = [];
    const suggestions = [];

    for (const extractedProduct of extractedProducts) {
      // Try to find exact match by product name
      let product = await Product.findOne({
        productName: { $regex: new RegExp(extractedProduct.product_name, 'i') },
        isActive: true
      });

      if (product) {
        matchedProducts.push({
          extracted: extractedProduct,
          matched: product,
          matchType: 'exact_name'
        });
      } else {
        // Try to find partial match
        const partialMatches = await Product.find({
          productName: { $regex: new RegExp(extractedProduct.product_name.split(' ')[0], 'i') },
          isActive: true
        }).limit(5);

        if (partialMatches.length > 0) {
          suggestions.push({
            extracted: extractedProduct,
            suggestions: partialMatches
          });
        } else {
          unmatchedProducts.push(extractedProduct);
        }
      }
    }

    return {
      success: true,
      matchedProducts: matchedProducts,
      unmatchedProducts: unmatchedProducts,
      suggestions: suggestions,
      summary: {
        totalExtracted: extractedProducts.length,
        totalMatched: matchedProducts.length,
        totalUnmatched: unmatchedProducts.length,
        totalSuggestions: suggestions.length
      }
    };

  } catch (error) {
    console.error('Error in matching service:', error);
    return {
      success: false,
      error: error.message,
      matchedProducts: [],
      unmatchedProducts: [],
      suggestions: []
    };
  }
};

/**
 * Create new products from unmatched OCR data
 * @param {Array} unmatchedProducts - Unmatched products from OCR
 * @param {ObjectId} userId - User who created the products
 * @returns {Promise<Object>} - Created products
 */
const createNewProducts = async (unmatchedProducts, userId) => {
  try {
    const newProducts = [];

    for (const product of unmatchedProducts) {
      const newProduct = new Product({
        itemNumber: product.item_number || newProducts.length + 1,
        productName: product.product_name,
        totalQuantity: product.total_quantity,
        subQuantities: product.sub_quantities || [],
        createdBy: userId
      });

      const savedProduct = await newProduct.save();
      newProducts.push(savedProduct);
    }

    return {
      success: true,
      products: newProducts,
      count: newProducts.length
    };

  } catch (error) {
    console.error('Error creating new products:', error);
    return {
      success: false,
      error: error.message,
      products: []
    };
  }
};

/**
 * Generate quotation number
 * @returns {string} - Generated quotation number
 */
const generateQuotationNumber = () => {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const timestamp = Date.now().toString().slice(-6);

  return `QT-${year}${month}${day}-${timestamp}`;
};

/**
 * Calculate quotation totals
 * @param {Array} items - Quotation items
 * @param {number} taxRate - Tax rate percentage
 * @param {number} discountAmount - Discount amount
 * @returns {Object} - Calculated totals
 */
const calculateQuotationTotals = (items, taxRate = 0, discountAmount = 0) => {
  const subtotal = items.reduce((sum, item) => sum + item.totalPrice, 0);
  const taxAmount = (subtotal * taxRate) / 100;
  const totalAmount = subtotal + taxAmount - discountAmount;

  return {
    subtotal: subtotal,
    taxAmount: taxAmount,
    discountAmount: discountAmount,
    totalAmount: totalAmount
  };
};

module.exports = {
  matchProducts,
  createNewProducts,
  generateQuotationNumber,
  calculateQuotationTotals
};
