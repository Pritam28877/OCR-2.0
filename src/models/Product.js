const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters']
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    trim: true,
    uppercase: true,
    maxlength: [50, 'SKU cannot exceed 50 characters']
  },
  catalogNumber: {
    type: String,
    trim: true,
    maxlength: [50, 'Catalog number cannot exceed 50 characters'],
    index: true
  },
  description: {
    type: String,
    trim: true,
    maxlength: [1000, 'Description cannot exceed 1000 characters']
  },
  categories: [{
    type: String,
    trim: true,
    maxlength: [100, 'Category name cannot exceed 100 characters']
  }],
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better search performance
productSchema.index({ name: 'text', description: 'text' });
productSchema.index({ sku: 1 });
productSchema.index({ categories: 1 });
productSchema.index({ price: 1 });
productSchema.index({ isActive: 1 });

// Pre-save middleware to update lastUpdated
productSchema.pre('save', function(next) {
  this.lastUpdated = new Date();
  next();
});

// Virtual for formatted price
productSchema.virtual('formattedPrice').get(function() {
  return `$${this.price.toFixed(2)}`;
});

module.exports = mongoose.model('Product', productSchema);
