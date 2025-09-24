const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  quantity: {
    type: String,
    required: true
  },
  unitPrice: {
    type: Number,
    required: true
  },
  totalPrice: {
    type: Number,
    required: true
  },
  notes: {
    type: String,
    required: false
  }
});

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true
  },
  customerName: {
    type: String,
    required: true
  },
  customerEmail: {
    type: String,
    required: true
  },
  customerPhone: {
    type: String,
    required: false
  },
  customerAddress: {
    type: String,
    required: false
  },
  items: [quotationItemSchema],
  subtotal: {
    type: Number,
    required: true
  },
  taxAmount: {
    type: Number,
    default: 0
  },
  discountAmount: {
    type: Number,
    default: 0
  },
  totalAmount: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['draft', 'sent', 'approved', 'rejected', 'completed'],
    default: 'draft'
  },
  notes: {
    type: String,
    required: false
  },
  validUntil: {
    type: Date,
    required: true
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Update the updatedAt field before saving
quotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Calculate totals before saving
quotationSchema.pre('save', function(next) {
  if (this.items && this.items.length > 0) {
    this.subtotal = this.items.reduce((sum, item) => sum + item.totalPrice, 0);
    this.totalAmount = this.subtotal + this.taxAmount - this.discountAmount;
  }
  next();
});

// Index for faster searches
quotationSchema.index({ customerEmail: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
