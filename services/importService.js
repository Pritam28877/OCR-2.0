const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const xlsx = require('xlsx');

/**
 * Parse a CSV or XLSX file and extract product data.
 * @param {string} filePath - Path to the file.
 * @returns {Promise<Object>} - Parsed products and validation results.
 */
const parseFile = (filePath) => {
    const fileExtension = path.extname(filePath).toLowerCase();
    if (fileExtension === '.csv') {
        return parseCSV(filePath);
    } else if (fileExtension === '.xlsx') {
        return parseXLSX(filePath);
    } else {
        return Promise.reject(new Error('Unsupported file type.'));
    }
};

/**
 * Parse CSV file.
 */
const parseCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const products = [];
    const errors = [];

    fs.createReadStream(filePath)
      .pipe(csv({ mapHeaders: ({ header }) => header.toLowerCase().trim() }))
      .on('data', (row) => {
        try {
          const product = parseProductRow(row);
          if (product) products.push(product);
        } catch (error) {
          errors.push({ row: products.length + 1, error: error.message, data: row });
        }
      })
      .on('end', () => resolve(formatParseResponse(products, errors)))
      .on('error', reject);
  });
};

/**
 * Parse XLSX file.
 */
const parseXLSX = (filePath) => {
    return new Promise((resolve, reject) => {
        try {
            const workbook = xlsx.readFile(filePath);
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = xlsx.utils.sheet_to_json(worksheet);

            const products = [];
            const errors = [];

            jsonData.forEach((row, index) => {
                try {
                    const product = parseProductRow(row);
                    if (product) products.push(product);
                } catch (error) {
                    errors.push({ row: index + 2, error: error.message, data: row });
                }
            });

            resolve(formatParseResponse(products, errors));
        } catch (error) {
            reject(error);
        }
    });
};

/**
 * Standardize the response format for parsers.
 */
const formatParseResponse = (products, errors) => ({
    products,
    errors,
    summary: {
        totalRows: products.length + errors.length,
        validProducts: products.length,
        errors: errors.length,
    },
});


/**
 * Parse a single row from the file into a product object.
 * This is now generalized to work with both CSV and XLSX.
 * @param {Object} row - Row data.
 * @returns {Object|null} - Product object or null if invalid.
 */
const parseProductRow = (row) => {
  // Normalize headers by trimming and converting to lower case
  const normalizedRow = Object.keys(row).reduce((acc, key) => {
      acc[key.toLowerCase().trim().replace(/ /g, '')] = row[key];
      return acc;
  }, {});

  const {
      catalogueid: catalogueId,
      productname,
      name: productName, // check for 'name' as a header
      description,
      brand,
      productclassification: classification,
      units,
      defaultsellingprice: price,
      defaultdiscount: defaultDiscount,
      hsncode: hsnCode,
      gstpercentage: gstPercentage,
  } = normalizedRow;

  const finalName = productname || productName;

  if (!catalogueId) throw new Error('Catalogue ID is required. Header must be "Catalogue ID" or "catalogueId".');
  if (!finalName) throw new Error('Product Name is required. Header must be "Product Name" or "productName".');

  return {
      catalogueId: String(catalogueId).trim(),
      name: String(finalName).trim(),
      description: description ? String(description).trim() : null,
      brand: brand ? String(brand).trim() : null,
      classification: classification ? String(classification).split(',').map(c => c.trim()) : [],
      units: units ? String(units).trim() : null,
      price: price ? parseFloat(price) : 0,
      defaultDiscount: defaultDiscount ? parseFloat(defaultDiscount) : 0,
      hsnCode: hsnCode ? String(hsnCode).trim() : null,
      gstPercentage: gstPercentage ? parseFloat(gstPercentage) : 0,
  };
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

    // Basic required field validation
    if (!product.catalogueId) productErrors.push('Catalogue ID is required.');
    if (!product.name) productErrors.push('Product name is required.');

    // Data type and range validation
    if (typeof product.price !== 'number' || isNaN(product.price) || product.price < 0) {
        productErrors.push('Price must be a non-negative number.');
    }
    if (typeof product.defaultDiscount !== 'number' || isNaN(product.defaultDiscount) || product.defaultDiscount < 0 || product.defaultDiscount > 100) {
        productErrors.push('Default discount must be a number between 0 and 100.');
    }
    if (typeof product.gstPercentage !== 'number' || isNaN(product.gstPercentage) || product.gstPercentage < 0) {
        productErrors.push('GST Percentage must be a non-negative number.');
    }

    if (productErrors.length > 0) {
      errors.push({ row: index + 1, product, errors: productErrors });
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
      invalidProducts: errors.length,
    },
  };
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
  parseFile,
  validateProducts,
  cleanupFile
};
