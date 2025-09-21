const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: false // Can be null for unmatched products
  },
  productName: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [1, 'Quantity must be at least 1']
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  matchedByOCR: {
    type: Boolean,
    default: false
  },
  manualEntry: {
    type: Boolean,
    default: false
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  confidence: {
    type: Number,
    min: 0,
    max: 1,
    default: 0
  }
});

const quotationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: false // Optional for now since auth is disabled
  },
  quotationNumber: {
    type: String,
    required: true
  },
  items: [quotationItemSchema],
  totalPrice: {
    type: Number,
    required: true,
    min: [0, 'Total price cannot be negative']
  },
  status: {
    type: String,
    enum: ['draft', 'pending', 'approved', 'rejected'],
    default: 'draft'
  },
  appliedDiscount: {
    type: Number,
    default: 0,
    min: [0, 'Discount cannot be negative'],
    max: [100, 'Discount cannot exceed 100%']
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: [0, 'Discount amount cannot be negative']
  },
  finalPrice: {
    type: Number,
    required: true,
    min: [0, 'Final price cannot be negative']
  },
  ocrData: {
    originalText: String,
    processedAt: Date,
    confidence: Number,
    imageUrl: String
  },
  customerInfo: {
    name: String,
    email: String,
    phone: String,
    address: String
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
quotationSchema.index({ quotationNumber: 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });
quotationSchema.index({ userId: 1 });

// Pre-save middleware to generate quotation number and calculate totals
quotationSchema.pre('save', function(next) {
  // Generate quotation number if not exists
  if (!this.quotationNumber) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    this.quotationNumber = `QUO-${timestamp}-${random}`;
  }

  // Calculate total price
  this.totalPrice = this.items.reduce((total, item) => {
    return total + (item.price * item.quantity);
  }, 0);

  // Calculate discount amount and final price
  this.discountAmount = (this.totalPrice * this.appliedDiscount) / 100;
  this.finalPrice = this.totalPrice - this.discountAmount;

  next();
});

// Virtual for formatted prices
quotationSchema.virtual('formattedTotalPrice').get(function() {
  return `$${this.totalPrice.toFixed(2)}`;
});

quotationSchema.virtual('formattedFinalPrice').get(function() {
  return `$${this.finalPrice.toFixed(2)}`;
});

quotationSchema.virtual('formattedDiscountAmount').get(function() {
  return `$${this.discountAmount.toFixed(2)}`;
});

// Method to add item to quotation
quotationSchema.methods.addItem = function(itemData) {
  this.items.push(itemData);
  return this.save();
};

// Method to remove item from quotation
quotationSchema.methods.removeItem = function(itemId) {
  this.items.id(itemId).remove();
  return this.save();
};

// Method to update item in quotation
quotationSchema.methods.updateItem = function(itemId, updateData) {
  const item = this.items.id(itemId);
  if (item) {
    Object.assign(item, updateData);
    return this.save();
  }
  throw new Error('Item not found');
};

module.exports = mongoose.model('Quotation', quotationSchema);
