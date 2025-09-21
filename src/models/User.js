const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  // Firebase UID - primary identifier
  firebaseUid: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Phone number (stored for quick lookup)
  phoneNumber: {
    type: String,
    required: true,
    unique: true,
    index: true,
    validate: {
      validator: function(v) {
        // Basic phone number validation (E.164 format)
        return /^\+[1-9]\d{1,14}$/.test(v);
      },
      message: 'Phone number must be in E.164 format (e.g., +1234567890)'
    }
  },
  
  // User profile information
  profile: {
    name: {
      type: String,
      trim: true,
      maxLength: [100, 'Name cannot exceed 100 characters']
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      validate: {
        validator: function(v) {
          return !v || /^\w+([.-]?\w+)*@\w+([.-]?\w+)*(\.\w{2,3})+$/.test(v);
        },
        message: 'Please enter a valid email address'
      }
    },
    avatar: {
      type: String,
      trim: true
    },
    company: {
      type: String,
      trim: true,
      maxLength: [200, 'Company name cannot exceed 200 characters']
    },
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      postalCode: String
    }
  },
  
  // User role and permissions
  role: {
    type: String,
    enum: ['user', 'admin', 'manager'],
    default: 'user'
  },
  
  // User preferences
  preferences: {
    language: {
      type: String,
      default: 'en',
      enum: ['en', 'es', 'fr', 'de', 'it', 'pt', 'hi', 'zh', 'ja', 'ko']
    },
    timezone: {
      type: String,
      default: 'UTC'
    },
    notifications: {
      email: {
        type: Boolean,
        default: true
      },
      sms: {
        type: Boolean,
        default: false
      },
      quotationUpdates: {
        type: Boolean,
        default: true
      },
      productUpdates: {
        type: Boolean,
        default: false
      }
    }
  },
  
  // Account status
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active'
  },
  
  // Usage statistics
  stats: {
    totalQuotations: {
      type: Number,
      default: 0
    },
    totalProducts: {
      type: Number,
      default: 0
    },
    lastLoginAt: {
      type: Date,
      default: null
    },
    loginCount: {
      type: Number,
      default: 0
    }
  },
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Soft delete
  deletedAt: {
    type: Date,
    default: null
  }
}, {
  timestamps: true, // Automatically manage createdAt and updatedAt
  toJSON: { 
    virtuals: true,
    transform: function(doc, ret) {
      delete ret._id;
      delete ret.__v;
      delete ret.deletedAt;
      return ret;
    }
  },
  toObject: { 
    virtuals: true 
  }
});

// Indexes for better query performance
userSchema.index({ firebaseUid: 1 });
userSchema.index({ phoneNumber: 1 });
userSchema.index({ 'profile.email': 1 });
userSchema.index({ role: 1 });
userSchema.index({ status: 1 });
userSchema.index({ createdAt: -1 });
userSchema.index({ deletedAt: 1 }); // For soft delete queries

// Virtual for full name
userSchema.virtual('fullName').get(function() {
  return this.profile.name || `User ${this.phoneNumber}`;
});

// Virtual for display phone (formatted)
userSchema.virtual('displayPhone').get(function() {
  if (!this.phoneNumber) return '';
  // Format: +1 (234) 567-8900
  const phone = this.phoneNumber.replace(/^\+/, '');
  if (phone.length === 11 && phone.startsWith('1')) {
    return `+1 (${phone.slice(1, 4)}) ${phone.slice(4, 7)}-${phone.slice(7)}`;
  }
  return this.phoneNumber;
});

// Pre-save middleware
userSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// Static method to find active users
userSchema.statics.findActive = function() {
  return this.find({ 
    deletedAt: null,
    status: 'active'
  });
};

// Static method to find by Firebase UID
userSchema.statics.findByFirebaseUid = function(firebaseUid) {
  return this.findOne({ 
    firebaseUid,
    deletedAt: null
  });
};

// Static method to find by phone number
userSchema.statics.findByPhone = function(phoneNumber) {
  return this.findOne({ 
    phoneNumber,
    deletedAt: null
  });
};

// Instance method for soft delete
userSchema.methods.softDelete = function() {
  this.deletedAt = new Date();
  this.status = 'suspended';
  return this.save();
};

// Instance method to update login stats
userSchema.methods.updateLoginStats = function() {
  this.stats.lastLoginAt = new Date();
  this.stats.loginCount += 1;
  return this.save();
};

// Instance method to increment quotation count
userSchema.methods.incrementQuotationCount = function() {
  this.stats.totalQuotations += 1;
  return this.save();
};

// Instance method to increment product count
userSchema.methods.incrementProductCount = function() {
  this.stats.totalProducts += 1;
  return this.save();
};

const User = mongoose.model('User', userSchema);

module.exports = User;
