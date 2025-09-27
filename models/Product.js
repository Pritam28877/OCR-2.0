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
  catalogueId: {
    type: String,
    required: false,
    unique: true,
    sparse: true,
  },
  name: {
    type: String,
    required: true,
  },
  description: {
    type: String,
    required: false,
  },
  brand: {
    type: String,
    required: false,
  },
  classification: {
    type: [String],
    required: false,
  },
  units: {
    type: String,
    required: false,
  },
  price: {
    type: Number,
    required: false,
  },
  defaultDiscount: {
    type: Number,
    default: 0,
  },
  hsnCode: {
    type: String,
    required: false,
  },
  gstPercentage: {
    type: Number,
    required: false,
  },
  subQuantities: [subQuantitySchema],
  isActive: {
    type: Boolean,
    default: true,
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false,
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
}, { timestamps: true });

// Update the updatedAt field before saving
productSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster searches
productSchema.index({ name: 1 });
productSchema.index({ classification: 1 });

module.exports = mongoose.model('Product', productSchema);
