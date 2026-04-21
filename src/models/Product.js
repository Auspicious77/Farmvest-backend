const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Please provide product name'],
    trim: true,
  },
  description: {
    type: String,
    required: [true, 'Please provide product description'],
  },
  category: {
    type: String,
    required: [true, 'Please provide product category'],
    enum: ['liquid', 'solid', 'livestock', 'poultry'],
  },
  
  // Unit Measurement
  unitType: {
    type: String,
    required: [true, 'Please provide unit type'],
    enum: ['gallon', 'bag', 'unit'], // gallon for liquids, bag for solids, unit for livestock/poultry
  },
  unitPrice: {
    type: Number,
    required: [true, 'Please provide unit price'],
    min: 0,
  },
  currentPrice: {
    type: Number,
    required: [true, 'Please provide current price'],
    min: 0,
  },
  minQuantity: {
    type: Number,
    required: [true, 'Please provide minimum quantity'],
    min: 1,
    default: 1,
  },
  maxQuantity: {
    type: Number,
    required: [true, 'Please provide maximum quantity'],
    min: 1,
    default: 1000,
  },
  imageUrl: {
    type: String,
    default: null,
  },
  icon: {
    type: String,
    default: null,
  },
  
  // Investment Details
  roiRange: {
    min: {
      type: Number,
      required: [true, 'Please provide minimum ROI'],
      min: 0,
    },
    max: {
      type: Number,
      required: [true, 'Please provide maximum ROI'],
      min: 0,
    },
  },
  duration: {
    type: Number, // in months
    required: [true, 'Please provide investment duration'],
    min: 1,
  },
  
  // Status
  status: {
    type: String,
    enum: ['open', 'closed'],
    default: 'closed',
  },
  totalInvested: {
    type: Number,
    default: 0,
  },
  investorsCount: {
    type: Number,
    default: 0,
  },
  maxInvestors: {
    type: Number,
    default: 100,
  },
  
  // Additional Details
  farmLocation: {
    type: String,
    default: null,
  },
  riskLevel: {
    type: String,
    enum: ['low', 'medium', 'high'],
    default: 'medium',
  },
  
  // Performance (admin updates with price changes)
  currentROI: {
    type: Number,
    default: 0,
  },
  priceHistory: [{
    date: {
      type: Date,
      required: true,
      default: Date.now,
    },
    price: {
      type: Number,
      required: true,
    },
    percentageChange: {
      type: Number,
      default: 0,
    },
    notes: {
      type: String,
      default: null,
    },
  }],
  
  // Flags
  isFeatured: {
    type: Boolean,
    default: false,
  },
  isRecommended: {
    type: Boolean,
    default: false,
  },
  
  // Admin
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Indexes
productSchema.index({ name: 1 });
productSchema.index({ category: 1 });
productSchema.index({ status: 1 });
productSchema.index({ isFeatured: 1 });
productSchema.index({ isRecommended: 1 });
productSchema.index({ createdAt: -1 });

// Validation: max should be greater than min
productSchema.pre('save', function(next) {
  if (this.roiRange.max < this.roiRange.min) {
    next(new Error('Maximum ROI must be greater than minimum ROI'));
  }
  if (this.maxQuantity < this.minQuantity) {
    next(new Error('Maximum quantity must be greater than minimum quantity'));
  }
  
  // Set initial currentPrice to unitPrice if not set
  if (!this.currentPrice) {
    this.currentPrice = this.unitPrice;
  }
  
  // Auto-determine unitType based on category
  if (!this.unitType) {
    if (this.category === 'liquid') {
      this.unitType = 'gallon';
    } else if (this.category === 'solid') {
      this.unitType = 'bag';
    } else if (this.category === 'livestock' || this.category === 'poultry') {
      this.unitType = 'unit';
    }
  }
  
  next();
});

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
