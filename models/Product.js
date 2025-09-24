const mongoose = require('mongoose');

const subQuantitySchema = new mongoose.Schema({
  color: {
    type: String,
    required: false
  },
  quantity: {
    type: String,
    required: false
  }
});

const productSchema = new mongoose.Schema({
  itemNumber: {
    type: String,
    required: true,
    unique: true
  },
  productNumber: {
    type: String
  },
  productName: {
    type: String,
    required: true
  },
  totalQuantity: {
    type: String,
    required: true
  },
  subQuantities: [subQuantitySchema],
  category: {
    type: String,
    required: false
  },
  catalogNo: {
    type: String
  },
  price: {
    type: Number,
    required: false
  },
  sku: {
    type: String
  },
  description: {
    type: String,
    required: false
  },
  imageUrl: {
    type: String,
    required: false
  },
  isActive: {
    type: Boolean,
    default: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, { timestamps: true });

// Update the updatedAt field before saving
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster searches
productSchema.index({ productName: 1 });
productSchema.index({ itemNumber: 1 });
productSchema.index({ category: 1 });

module.exports = mongoose.model('Product', productSchema);
