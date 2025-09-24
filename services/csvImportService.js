const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

/**
 * Parse CSV file and extract product data
 * @param {string} filePath - Path to CSV file
 * @returns {Promise<Object>} - Parsed products and validation results
 */
const parseCSVFile = (filePath) => {
  return new Promise((resolve, reject) => {
    const products = [];
    const errors = [];

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return reject(new Error('CSV file not found'));
    }

    // Read and parse CSV
    fs.createReadStream(filePath)
      .pipe(csv({
        mapHeaders: ({ header }) => header.toLowerCase()
      }))
      .on('data', (row) => {
        try {
          const product = parseProductRow(row);
          if (product) {
            products.push(product);
          }
        } catch (error) {
          errors.push({
            row: products.length + 1,
            error: error.message,
            data: row
          });
        }
      })
      .on('end', () => {
        resolve({
          products,
          errors,
          summary: {
            totalRows: products.length + errors.length,
            validProducts: products.length,
            errors: errors.length
          }
        });
      })
      .on('error', (error) => {
        reject(error);
      });
  });
};

/**
 * Parse a single row from CSV into product object
 * @param {Object} row - CSV row data
 * @returns {Object|null} - Product object or null if invalid
 */
const parseProductRow = (row) => {
  try {
    // Required fields from model, mapped from CSV
    const itemNumber = (row.productnumber || '').trim(); // Adjusted to use the specific header from your CSV
    const productName = (row.productdescription || '').trim(); // Adjusted to use the specific header from your CSV
    // Assuming a default value if not in CSV, as it's required by the model
    const totalQuantity = (row.totalquantity || '0').trim();

    if (!itemNumber) {
      throw new Error('Item number is required');
    }
    if (!productName) {
      throw new Error('Product name is required');
    }

    // Optional fields
    const productNumber = (row.productnumber || '').trim();
    const catalogNo = (row.catalogno || '').trim();
    const sku = (row.sku || '').trim();
    const category = (row.category || '').trim();
    const price = row.price ? parseFloat(row.price) : undefined;
    const description = (row.productdescription || '').trim(); // You can decide if description should be productName
    const imageUrl = (row.imageurl || '').trim();

    // Parse sub quantities if available
    let subQuantities = [];
    if (row.subquantities) {
      try {
        const subQtyStr = (row.subquantities).trim();
        if (subQtyStr) {
          subQuantities = JSON.parse(subQtyStr);
        }
      } catch (error) {
        // If JSON parsing fails, try to parse as simple format
        subQuantities = parseSubQuantitiesString(subQtyStr);
      }
    }

    return {
      itemNumber,
      productNumber,
      productName,
      totalQuantity,
      category,
      catalogNo,
      price,
      sku,
      description,
      imageUrl,
      subQuantities: subQuantities || []
    };
  } catch (error) {
    throw new Error(`Invalid data format: ${error.message}`);
  }
};

/**
 * Parse sub quantities from string format (e.g., "Red:10,Blue:5")
 * @param {string} subQtyStr - Sub quantities string
 * @returns {Array} - Array of sub quantity objects
 */
const parseSubQuantitiesString = (subQtyStr) => {
  if (!subQtyStr) return [];

  const subQuantities = [];

  try {
    // Try parsing as JSON first
    return JSON.parse(subQtyStr);
  } catch (error) {
    // Parse as comma-separated values
    const pairs = subQtyStr.split(',');

    pairs.forEach(pair => {
      const [color, quantity] = pair.split(':').map(s => s.trim());
      if (color && quantity) {
        subQuantities.push({
          color: color,
          quantity: quantity
        });
      }
    });
  }

  return subQuantities;
};

/**
 * Validate products data before import
 * @param {Array} products - Array of product objects
 * @returns {Object} - Validation results
 */
const validateProducts = (products) => {
  const errors = [];
  const validProducts = [];

  products.forEach((product, index) => {
    const productErrors = [];

    // Validate required fields
    if (!product.productName) {
      productErrors.push('Product name is required');
    }

    if (!product.totalQuantity) {
      productErrors.push('Total quantity is required');
    }

    // Validate numeric fields
    if (product.price && (isNaN(product.price) || product.price < 0)) {
      productErrors.push('Price must be a positive number');
    }

    // Validate sub quantities
    if (product.subQuantities && Array.isArray(product.subQuantities)) {
      product.subQuantities.forEach((subQty, subIndex) => {
        if (!subQty.color) {
          productErrors.push(`Sub quantity at index ${subIndex} is missing color`);
        }
        if (!subQty.quantity) {
          productErrors.push(`Sub quantity at index ${subIndex} is missing quantity`);
        }
      });
    }

    if (productErrors.length > 0) {
      errors.push({
        row: index + 1,
        product: product,
        errors: productErrors
      });
    } else {
      validProducts.push(product);
    }
  });

  return {
    validProducts,
    errors,
    summary: {
      totalProducts: products.length,
      validProducts: validProducts.length,
      invalidProducts: errors.length
    }
  };
};

/**
 * Generate CSV template for product import
 * @returns {string} - CSV template content
 */
const generateCSVTemplate = () => {
  const headers = [
    'itemNumber',
    'productNumber',
    'productName',
    'totalQuantity',
    'category',
    'catalogNo',
    'price',
    'sku',
    'description',
    'imageUrl',
    'subQuantities'
  ];

  const sampleData = [
    'PN001,"PROD001","Sample Product 1","100 pieces","Electronics","CAT001",29.99,"SKU001","A sample electronic product","https://example.com/image1.jpg","[{\"color\":\"Red\",\"quantity\":\"50\"},{\"color\":\"Blue\",\"quantity\":\"50\"}]"',
    'PN002,"PROD002","Sample Product 2","50 units","Clothing","CAT002",19.99,"SKU002","A sample clothing item","https://example.com/image2.jpg","[{\"color\":\"Small\",\"quantity\":\"20\"},{\"color\":\"Medium\",\"quantity\":\"20\"},{\"color\":\"Large\",\"quantity\":\"10\"}]"'
  ];

  return [headers.join(','), ...sampleData].join('\n');
};

/**
 * Clean up uploaded files
 * @param {string} filePath - Path to file to delete
 */
const cleanupFile = (filePath) => {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    console.error('Error cleaning up file:', error);
  }
};

module.exports = {
  parseCSVFile,
  validateProducts,
  generateCSVTemplate,
  cleanupFile
};
