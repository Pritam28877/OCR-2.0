const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure upload directory exists
const uploadDir = process.env.UPLOAD_DIR || './uploads';
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Configure storage
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    // Generate unique filename
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

// File filter function
const fileFilter = (req, file, cb) => {
  // Check file type
  const allowedTypes = /jpeg|jpg|png|pdf/;
  const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = allowedTypes.test(file.mimetype);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only JPEG, JPG, PNG, and PDF files are allowed'), false);
  }
};

// Configure multer
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
    files: 5 // Maximum 5 files
  },
  fileFilter: fileFilter
});

// Middleware for single file upload
const uploadSingle = (fieldName) => {
  return (req, res, next) => {
    const singleUpload = upload.single(fieldName);
    
    singleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum size is 10MB.'
            });
          }
          if (err.code === 'LIMIT_UNEXPECTED_FILE') {
            return res.status(400).json({
              success: false,
              error: 'Unexpected file field.'
            });
          }
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// Middleware for multiple file upload
const uploadMultiple = (fieldName, maxCount = 5) => {
  return (req, res, next) => {
    const multipleUpload = upload.array(fieldName, maxCount);
    
    multipleUpload(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError) {
          if (err.code === 'LIMIT_FILE_SIZE') {
            return res.status(400).json({
              success: false,
              error: 'File too large. Maximum size is 10MB.'
            });
          }
          if (err.code === 'LIMIT_FILE_COUNT') {
            return res.status(400).json({
              success: false,
              error: `Too many files. Maximum is ${maxCount}.`
            });
          }
        }
        return res.status(400).json({
          success: false,
          error: err.message
        });
      }
      next();
    });
  };
};

// Middleware for CSV file upload
const uploadCSV = (req, res, next) => {
  const csvUpload = multer({
    storage: storage,
    limits: {
      fileSize: 5 * 1024 * 1024, // 5MB limit for CSV
    },
    fileFilter: (req, file, cb) => {
      if (file.mimetype === 'text/csv' || path.extname(file.originalname).toLowerCase() === '.csv') {
        cb(null, true);
      } else {
        cb(new Error('Only CSV files are allowed'), false);
      }
    }
  }).single('csvFile');

  csvUpload(req, res, (err) => {
    if (err) {
      if (err instanceof multer.MulterError) {
        if (err.code === 'LIMIT_FILE_SIZE') {
          return res.status(400).json({
            success: false,
            error: 'CSV file too large. Maximum size is 5MB.'
          });
        }
      }
      return res.status(400).json({
        success: false,
        error: err.message
      });
    }
    next();
  });
};

module.exports = {
  upload,
  uploadSingle,
  uploadMultiple,
  uploadCSV
};
