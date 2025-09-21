const { body, param, query, validationResult } = require('express-validator');

// Validation result handler
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      error: 'Validation failed',
      details: errors.array()
    });
  }
  next();
};

// Product validation rules
const validateProduct = [
  body('name')
    .trim()
    .notEmpty()
    .withMessage('Product name is required')
    .isLength({ max: 200 })
    .withMessage('Product name cannot exceed 200 characters'),
  
  body('sku')
    .trim()
    .notEmpty()
    .withMessage('SKU is required')
    .isLength({ max: 50 })
    .withMessage('SKU cannot exceed 50 characters')
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('SKU can only contain uppercase letters, numbers, hyphens, and underscores'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array'),
  
  body('categories.*')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Category name cannot exceed 100 characters'),
  
  body('price')
    .isNumeric()
    .withMessage('Price must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Price cannot be negative');
      }
      return true;
    }),
  
  body('metadata')
    .optional()
    .isObject()
    .withMessage('Metadata must be an object'),
  
  handleValidationErrors
];

// Product update validation (partial)
const validateProductUpdate = [
  body('name')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Product name cannot be empty')
    .isLength({ max: 200 })
    .withMessage('Product name cannot exceed 200 characters'),
  
  body('sku')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('SKU cannot be empty')
    .isLength({ max: 50 })
    .withMessage('SKU cannot exceed 50 characters')
    .matches(/^[A-Z0-9-_]+$/)
    .withMessage('SKU can only contain uppercase letters, numbers, hyphens, and underscores'),
  
  body('description')
    .optional()
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Description cannot exceed 1000 characters'),
  
  body('categories')
    .optional()
    .isArray()
    .withMessage('Categories must be an array'),
  
  body('price')
    .optional()
    .isNumeric()
    .withMessage('Price must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Price cannot be negative');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Quotation validation rules
const validateQuotation = [
  body('items')
    .isArray({ min: 1 })
    .withMessage('Quotation must have at least one item'),
  
  body('items.*.productName')
    .trim()
    .notEmpty()
    .withMessage('Product name is required for each item'),
  
  body('items.*.quantity')
    .isInt({ min: 1 })
    .withMessage('Quantity must be a positive integer'),
  
  body('items.*.price')
    .isNumeric()
    .withMessage('Price must be a number')
    .custom((value) => {
      if (value < 0) {
        throw new Error('Price cannot be negative');
      }
      return true;
    }),
  
  body('items.*.notes')
    .optional()
    .trim()
    .isLength({ max: 500 })
    .withMessage('Notes cannot exceed 500 characters'),
  
  body('appliedDiscount')
    .optional()
    .isNumeric()
    .withMessage('Discount must be a number')
    .custom((value) => {
      if (value < 0 || value > 100) {
        throw new Error('Discount must be between 0 and 100');
      }
      return true;
    }),
  
  body('customerInfo.name')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Customer name cannot exceed 100 characters'),
  
  body('customerInfo.email')
    .optional()
    .trim()
    .isEmail()
    .withMessage('Invalid email format'),
  
  body('customerInfo.phone')
    .optional()
    .trim()
    .isMobilePhone()
    .withMessage('Invalid phone number format'),
  
  handleValidationErrors
];

// Quotation update validation
const validateQuotationUpdate = [
  body('status')
    .optional()
    .isIn(['draft', 'pending', 'approved', 'rejected'])
    .withMessage('Invalid status value'),
  
  body('appliedDiscount')
    .optional()
    .isNumeric()
    .withMessage('Discount must be a number')
    .custom((value) => {
      if (value < 0 || value > 100) {
        throw new Error('Discount must be between 0 and 100');
      }
      return true;
    }),
  
  handleValidationErrors
];

// Parameter validation
const validateObjectId = (paramName) => [
  param(paramName)
    .isMongoId()
    .withMessage(`Invalid ${paramName} format`),
  handleValidationErrors
];

// Query validation
const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),
  
  query('limit')
    .optional()
    .isInt({ min: 1, max: 100 })
    .withMessage('Limit must be between 1 and 100'),
  
  handleValidationErrors
];

const validateSearch = [
  query('query')
    .trim()
    .notEmpty()
    .withMessage('Search query is required')
    .isLength({ min: 2, max: 100 })
    .withMessage('Search query must be between 2 and 100 characters'),
  
  query('fuzzy')
    .optional()
    .isBoolean()
    .withMessage('Fuzzy must be a boolean value'),
  
  handleValidationErrors
];

module.exports = {
  validateProduct,
  validateProductUpdate,
  validateQuotation,
  validateQuotationUpdate,
  validateObjectId,
  validatePagination,
  validateSearch,
  handleValidationErrors
};
