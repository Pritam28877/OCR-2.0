const mongoose = require('mongoose');

const quotationItemSchema = new mongoose.Schema({
  product: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true
  },
  productName: { type: String, required: true },
  quantity: { type: Number, required: true },
  units: { type: String, required: false },
  price: { type: Number, required: true },
  discountPercentage: { type: Number, default: 0 },
  gstPercentage: { type: Number, default: 0 },
  netPrice: { type: Number, required: true },
  taxAmount: { type: Number, required: true },
  itemTotal: { type: Number, required: true },
});

const quotationSchema = new mongoose.Schema({
  quotationNumber: {
    type: String,
    required: true,
    unique: true,
  },
  customer: {
    name: { type: String, required: true },
    email: { type: String, required: false },
    phone: { type: String, required: false },
    address: { type: String, required: false },
  },
  items: [quotationItemSchema],
  subtotal: { type: Number, required: true, default: 0 },
  totalDiscountAmount: { type: Number, required: true, default: 0 },
  totalGstAmount: { type: Number, required: true, default: 0 },
  grandTotal: { type: Number, required: true, default: 0 },
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
    required: false
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
}, { timestamps: true });

// Update the updatedAt field before saving
quotationSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

// Index for faster searches
quotationSchema.index({ 'customer.email': 1 });
quotationSchema.index({ status: 1 });
quotationSchema.index({ createdAt: -1 });

module.exports = mongoose.model('Quotation', quotationSchema);
