const csv = require('csv-parser');
const fs = require('fs');
const Product = require('../models/Product');

class CSVProcessor {
  constructor() {
    this.requiredFields = ['name', 'sku', 'price'];
    this.optionalFields = ['description', 'categories', 'catalogNumber'];
  }

  /**
   * Process CSV file and import products
   * @param {string} filePath - Path to CSV file
   * @returns {Object} - Import results
   */
  async processCSVFile(filePath) {
    return new Promise((resolve, reject) => {
      const results = [];
      const errors = [];
      let lineNumber = 1; // Start from 1 (header is line 1)

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data) => {
          lineNumber++;
          try {
            const processedRow = this.processRow(data, lineNumber);
            if (processedRow.isValid) {
              results.push(processedRow.data);
            } else {
              errors.push({
                line: lineNumber,
                errors: processedRow.errors,
                data: data
              });
            }
          } catch (error) {
            errors.push({
              line: lineNumber,
              errors: [`Processing error: ${error.message}`],
              data: data
            });
          }
        })
        .on('end', async () => {
          try {
            const importResult = await this.importProducts(results);
            resolve({
              success: true,
              totalRows: lineNumber - 1,
              validRows: results.length,
              invalidRows: errors.length,
              imported: importResult.imported,
              updated: importResult.updated,
              skipped: importResult.skipped,
              errors: errors,
              importErrors: importResult.errors
            });
          } catch (error) {
            reject(error);
          }
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }

  /**
   * Process individual CSV row
   * @param {Object} row - CSV row data
   * @param {number} lineNumber - Line number for error reporting
   * @returns {Object} - Processed row result
   */
  processRow(row, lineNumber) {
    const errors = [];
    const data = {};

    // Check required fields
    for (const field of this.requiredFields) {
      const value = row[field]?.toString().trim();
      if (!value) {
        errors.push(`Missing required field: ${field}`);
      } else {
        data[field] = value;
      }
    }

    // Process optional fields
    for (const field of this.optionalFields) {
      const value = row[field]?.toString().trim();
      if (value) {
        if (field === 'categories') {
          // Split categories by comma and clean up
          data[field] = value.split(',').map(cat => cat.trim()).filter(cat => cat.length > 0);
        } else {
          data[field] = value;
        }
      }
    }

    // Validate and convert price
    if (data.price) {
      const price = parseFloat(data.price);
      if (isNaN(price) || price < 0) {
        errors.push('Price must be a valid positive number');
      } else {
        data.price = price;
      }
    }

    // Validate and format SKU
    if (data.sku) {
      data.sku = data.sku.toUpperCase().replace(/\s+/g, '');
      if (!/^[A-Z0-9-_]+$/.test(data.sku)) {
        errors.push('SKU can only contain uppercase letters, numbers, hyphens, and underscores');
      }
    }

    // Validate name length
    if (data.name && data.name.length > 200) {
      errors.push('Product name cannot exceed 200 characters');
    }

    // Validate description length
    if (data.description && data.description.length > 1000) {
      errors.push('Description cannot exceed 1000 characters');
    }

    // Add metadata
    data.metadata = {
      importedAt: new Date(),
      importSource: 'csv',
      originalLine: lineNumber
    };

    return {
      isValid: errors.length === 0,
      data: data,
      errors: errors
    };
  }

  /**
   * Import processed products to database
   * @param {Array} products - Array of processed product data
   * @returns {Object} - Import statistics
   */
  async importProducts(products) {
    const stats = {
      imported: 0,
      updated: 0,
      skipped: 0,
      errors: []
    };

    for (const productData of products) {
      try {
        // Check if product with same SKU exists
        const existingProduct = await Product.findOne({ sku: productData.sku });

        if (existingProduct) {
          // Update existing product
          Object.assign(existingProduct, productData);
          await existingProduct.save();
          stats.updated++;
        } else {
          // Create new product
          const newProduct = new Product(productData);
          await newProduct.save();
          stats.imported++;
        }
      } catch (error) {
        stats.errors.push({
          sku: productData.sku,
          name: productData.name,
          error: error.message
        });
        stats.skipped++;
      }
    }

    return stats;
  }

  /**
   * Generate CSV template for product import
   * @returns {string} - CSV template content
   */
  generateTemplate() {
    const headers = [
      'name',
      'sku', 
      'price',
      'description',
      'categories'
    ];

    const sampleData = [
      'Sample Product 1',
      'SAMPLE-001',
      '29.99',
      'This is a sample product description',
      'Electronics, Gadgets'
    ];

    const csvContent = [
      headers.join(','),
      sampleData.join(',')
    ].join('\n');

    return csvContent;
  }

  /**
   * Validate CSV file structure
   * @param {string} filePath - Path to CSV file
   * @returns {Object} - Validation result
   */
  async validateCSVStructure(filePath) {
    return new Promise((resolve, reject) => {
      let headerChecked = false;
      const issues = [];

      fs.createReadStream(filePath)
        .pipe(csv())
        .on('headers', (headers) => {
          headerChecked = true;
          
          // Check for required headers
          const missingHeaders = this.requiredFields.filter(field => 
            !headers.some(header => header.toLowerCase() === field.toLowerCase())
          );

          if (missingHeaders.length > 0) {
            issues.push(`Missing required columns: ${missingHeaders.join(', ')}`);
          }

          // Check for extra/unknown headers
          const knownFields = [...this.requiredFields, ...this.optionalFields];
          const unknownHeaders = headers.filter(header => 
            !knownFields.some(field => field.toLowerCase() === header.toLowerCase())
          );

          if (unknownHeaders.length > 0) {
            issues.push(`Unknown columns (will be ignored): ${unknownHeaders.join(', ')}`);
          }
        })
        .on('data', () => {
          // We only need to check the first row for structure
          // End the stream early
        })
        .on('end', () => {
          resolve({
            isValid: issues.length === 0,
            issues: issues,
            hasRequiredFields: headerChecked && issues.filter(issue => issue.includes('Missing required')).length === 0
          });
        })
        .on('error', (error) => {
          reject(error);
        });
    });
  }
}

module.exports = CSVProcessor;
