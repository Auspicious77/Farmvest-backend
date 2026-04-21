# Nestly - Backend API

> **✅ Implementation Status: 100% Complete** | Last Updated: November 5, 2025

## Overview
Node.js backend API for Nestly, an agriculture investment platform that enables users to invest in local agricultural products (palm oil, palm kernel oil, yam, maize, cocoa pod ash, etc.) with real-time performance tracking and secure wallet management.

**All core features are fully implemented and production-ready.** See [IMPLEMENTATION_SUMMARY.md](./IMPLEMENTATION_SUMMARY.md) for complete details.

## Tech Stack
- **Runtime**: Node.js (v18+)
- **Framework**: Express.js / NestJS
- **Database**: MongoDB (unstructured data) + PostgreSQL (structured data)
- **Cache**: Redis (real-time data, sessions)
- **Authentication**: JWT + 2FA
- **File Storage**: AWS S3 / Cloudinary
- **Payment Integration**: Paystack, PalmPay, Monnify/Flutterwave (Virtual Accounts)
- **KYC Verification**: Smile Identity API
- **Real-time**: WebSocket / Socket.io
- **Email**: NodeMailer (SMTP)

## Key Features
- User authentication with email verification
- BVN/NIN verification for KYC compliance
- Wallet management (fund, withdraw, transaction PIN)
- Investment products (create, open/close, invest)
- Real-time performance chart updates (admin-driven)
- Transaction and investment history
- Recommendation engine
- Admin dashboard APIs
- Push notifications
- Role-based access control (Super Admin, Investment Manager, Support)

## Project Structure
```
backend/
├── src/
│   ├── config/
│   │   ├── database.js         # MongoDB & PostgreSQL config
│   │   ├── redis.js            # Redis cache config
│   │   ├── aws.js              # AWS S3 config
│   │   └── payment.js          # Payment gateway configs
│   ├── controllers/
│   │   ├── auth.controller.js
│   │   ├── user.controller.js
│   │   ├── wallet.controller.js
│   │   ├── investment.controller.js
│   │   ├── product.controller.js
│   │   ├── admin.controller.js
│   │   └── notification.controller.js
│   ├── models/
│   │   ├── User.js
│   │   ├── Product.js
│   │   ├── Investment.js
│   │   ├── Transaction.js
│   │   ├── Wallet.js
│   │   └── PerformanceData.js
│   ├── routes/
│   │   ├── auth.routes.js
│   │   ├── user.routes.js
│   │   ├── wallet.routes.js
│   │   ├── investment.routes.js
│   │   ├── product.routes.js
│   │   └── admin.routes.js
│   ├── middleware/
│   │   ├── auth.middleware.js
│   │   ├── rbac.middleware.js  # Role-based access control
│   │   ├── validation.middleware.js
│   │   ├── rateLimit.middleware.js
│   │   └── error.middleware.js
│   ├── services/
│   │   ├── auth.service.js
│   │   ├── email.service.js
│   │   ├── kyc.service.js      # BVN/NIN verification
│   │   ├── payment.service.js  # Paystack, PalmPay
│   │   ├── wallet.service.js
│   │   ├── investment.service.js
│   │   ├── recommendation.service.js
│   │   └── notification.service.js
│   ├── utils/
│   │   ├── jwt.util.js
│   │   ├── encryption.util.js
│   │   ├── validation.util.js
│   │   └── helpers.util.js
│   ├── validators/
│   │   ├── auth.validator.js
│   │   ├── user.validator.js
│   │   ├── investment.validator.js
│   │   └── wallet.validator.js
│   ├── sockets/
│   │   └── performance.socket.js  # Real-time chart updates
│   └── app.js
├── tests/
├── .env.example
├── .gitignore
├── package.json
└── server.js
```

## Database Schema

### MongoDB Collections

#### User
```javascript
{
  _id: ObjectId,
  fullName: String,
  email: String (unique, indexed),
  phone: String,
  password: String (hashed),
  profilePicture: String (URL),
  address: String,
  
  // KYC
  bvn: String (encrypted),
  nin: String (encrypted),
  kycStatus: Enum ['unverified', 'pending', 'verified'],
  walletTier: Enum ['basic', 'verified'], // Basic: max ₦100k, Verified: higher
  
  // Security
  transactionPin: String (hashed),
  twoFactorEnabled: Boolean,
  twoFactorSecret: String,
  biometricEnabled: Boolean,
  
  // Status
  isEmailVerified: Boolean,
  isActive: Boolean,
  
  // Metadata
  lastLogin: Date,
  deviceTokens: [String], // Push notification tokens
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Product (Agricultural Investment)
```javascript
{
  _id: ObjectId,
  name: String, // e.g., "Palm Oil", "Palm Kernel Oil"
  description: String,
  category: String, // e.g., "Oil", "Grains", "Tubers"
  imageUrl: String,
  icon: String,
  
  // Investment Details
  roiRange: {
    min: Number, // e.g., 5
    max: Number  // e.g., 15
  },
  duration: Number, // in days (e.g., 90)
  minInvestment: Number, // e.g., 5000
  maxInvestment: Number, // e.g., 1000000
  
  // Status
  status: Enum ['open', 'closed'],
  totalInvested: Number,
  investorsCount: Number,
  
  // Performance (admin updates daily)
  currentROI: Number,
  performanceHistory: [
    {
      date: Date,
      roi: Number,
      percentageChange: Number
    }
  ],
  
  // Flags
  isFeatured: Boolean,
  isRecommended: Boolean,
  
  // Admin
  createdBy: ObjectId (ref: User),
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Investment
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  product: ObjectId (ref: Product),
  
  amount: Number,
  expectedROI: Number,
  currentROI: Number,
  roiEarned: Number,
  
  startDate: Date,
  endDate: Date,
  duration: Number, // in days
  
  status: Enum ['active', 'completed', 'withdrawn'],
  
  // Performance tracking
  dailyPerformance: [
    {
      date: Date,
      roi: Number,
      percentageChange: Number
    }
  ],
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Wallet
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User, unique),
  balance: Number (default: 0),
  
  // Virtual Account for Bank Transfers
  virtualAccount: {
    accountNumber: String,
    accountName: String,
    bankName: String,
    provider: String // e.g., "monnify", "flutterwave"
  },
  
  // Primary Bank Account (for withdrawals)
  primaryAccount: {
    accountNumber: String,
    accountName: String,
    bankCode: String,
    bankName: String
  },
  
  totalFunded: Number,
  totalWithdrawn: Number,
  totalInvested: Number,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Transaction
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  wallet: ObjectId (ref: Wallet),
  
  type: Enum ['funding', 'withdrawal', 'investment', 'roi_payout'],
  amount: Number,
  
  // Payment Details
  paymentMethod: Enum ['bank_transfer', 'paystack', 'palmpay'],
  paymentProvider: String,
  reference: String (unique, indexed),
  
  status: Enum ['pending', 'successful', 'failed'],
  
  // For withdrawals
  destinationAccount: {
    accountNumber: String,
    accountName: String,
    bankName: String
  },
  
  // Metadata
  description: String,
  metadata: Object,
  
  createdAt: Date,
  updatedAt: Date
}
```

#### Notification
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  
  title: String,
  message: String,
  type: Enum ['investment', 'wallet', 'kyc', 'general'],
  
  isRead: Boolean (default: false),
  isPush: Boolean, // Was it sent as push notification?
  
  data: Object, // Additional data for deep linking
  
  createdAt: Date
}
```

#### Recommendation
```javascript
{
  _id: ObjectId,
  user: ObjectId (ref: User),
  product: ObjectId (ref: Product),
  
  reason: String, // "Trending", "High ROI", "Based on your activity"
  score: Number, // Recommendation score
  
  isDisplayed: Boolean,
  isActedUpon: Boolean,
  
  createdAt: Date,
  expiresAt: Date
}
```

## API Endpoints

### Authentication
```
POST   /api/v1/auth/register
POST   /api/v1/auth/verify-email
POST   /api/v1/auth/resend-verification
POST   /api/v1/auth/login
POST   /api/v1/auth/logout
POST   /api/v1/auth/forgot-password
POST   /api/v1/auth/reset-password
POST   /api/v1/auth/refresh-token
POST   /api/v1/auth/enable-2fa
POST   /api/v1/auth/verify-2fa
```

### User Profile
```
GET    /api/v1/users/profile
PUT    /api/v1/users/profile
POST   /api/v1/users/upload-profile-picture
POST   /api/v1/users/verify-bvn
POST   /api/v1/users/verify-nin
PUT    /api/v1/users/change-password
POST   /api/v1/users/set-transaction-pin
PUT    /api/v1/users/change-transaction-pin
POST   /api/v1/users/verify-transaction-pin
PUT    /api/v1/users/update-primary-account
```

### Wallet
```
GET    /api/v1/wallet
POST   /api/v1/wallet/fund/bank-transfer    # Get virtual account details
POST   /api/v1/wallet/fund/paystack          # Initialize Paystack payment
POST   /api/v1/wallet/fund/palmpay           # Initialize PalmPay payment
POST   /api/v1/wallet/withdraw
GET    /api/v1/wallet/transactions
GET    /api/v1/wallet/transactions/:id

# Webhooks (for payment confirmations)
POST   /api/v1/webhooks/paystack
POST   /api/v1/webhooks/palmpay
POST   /api/v1/webhooks/monnify
```

### Products (Investments)
```
GET    /api/v1/products                      # Get all available products
GET    /api/v1/products/featured
GET    /api/v1/products/recommendations
GET    /api/v1/products/:id
GET    /api/v1/products/:id/performance      # Get performance chart data
```

### Investments
```
POST   /api/v1/investments                   # Create new investment
GET    /api/v1/investments                   # Get user's investments
GET    /api/v1/investments/active
GET    /api/v1/investments/completed
GET    /api/v1/investments/:id
GET    /api/v1/investments/:id/performance   # Get investment performance data
```

### History
```
GET    /api/v1/history/transactions          # Wallet transactions
GET    /api/v1/history/investments           # Investment history
```

### Notifications
```
GET    /api/v1/notifications
PUT    /api/v1/notifications/:id/read
PUT    /api/v1/notifications/mark-all-read
POST   /api/v1/notifications/register-device # Register device token for push
```

### Admin Routes
```
# User Management
GET    /api/v1/admin/users
GET    /api/v1/admin/users/:id
PUT    /api/v1/admin/users/:id/suspend
PUT    /api/v1/admin/users/:id/activate
PUT    /api/v1/admin/users/:id/verify-kyc
GET    /api/v1/admin/users/kyc-pending

# Product Management
POST   /api/v1/admin/products                # Create product
PUT    /api/v1/admin/products/:id            # Update product
DELETE /api/v1/admin/products/:id
PUT    /api/v1/admin/products/:id/open       # Open investment window
PUT    /api/v1/admin/products/:id/close      # Close investment window
POST   /api/v1/admin/products/:id/update-performance  # Daily update

# Investment Management
GET    /api/v1/admin/investments
GET    /api/v1/admin/investments/:id
PUT    /api/v1/admin/investments/:id/complete

# Transaction Management
GET    /api/v1/admin/transactions
GET    /api/v1/admin/transactions/pending-withdrawals
PUT    /api/v1/admin/transactions/:id/approve
PUT    /api/v1/admin/transactions/:id/reject

# Analytics
GET    /api/v1/admin/analytics/overview
GET    /api/v1/admin/analytics/users
GET    /api/v1/admin/analytics/investments
GET    /api/v1/admin/analytics/revenue
GET    /api/v1/admin/analytics/top-products

# Notifications
POST   /api/v1/admin/notifications/broadcast
POST   /api/v1/admin/notifications/send-to-user
```

## Environment Variables
```env
NODE_ENV=development
PORT=5000

# Database
MONGODB_URI=mongodb://localhost:27017/nestly
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DB=nestly
POSTGRES_USER=postgres
POSTGRES_PASSWORD=password

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379
REDIS_PASSWORD=

# JWT
JWT_SECRET=your_jwt_secret_key
JWT_EXPIRE=7d
JWT_REFRESH_SECRET=your_refresh_secret
JWT_REFRESH_EXPIRE=30d

# Email (NodeMailer)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
EMAIL_FROM=noreply@nestly.com

# KYC Verification (Smile Identity)
SMILE_API_KEY=your_smile_api_key
SMILE_PARTNER_ID=your_partner_id

# Payment Gateways
# Paystack
PAYSTACK_SECRET_KEY=sk_test_xxxxx
PAYSTACK_PUBLIC_KEY=pk_test_xxxxx

# PalmPay
PALMPAY_API_KEY=your_palmpay_key
PALMPAY_SECRET_KEY=your_palmpay_secret

# Monnify (Virtual Accounts)
MONNIFY_API_KEY=your_monnify_key
MONNIFY_SECRET_KEY=your_monnify_secret
MONNIFY_CONTRACT_CODE=your_contract_code

# AWS S3
AWS_ACCESS_KEY_ID=your_aws_key
AWS_SECRET_ACCESS_KEY=your_aws_secret
AWS_S3_BUCKET=nestly-uploads
AWS_REGION=us-east-1

# Frontend URLs
CLIENT_URL=http://localhost:19000
ADMIN_URL=http://localhost:3000

# Push Notifications
FCM_SERVER_KEY=your_fcm_server_key

# Security
ENCRYPTION_KEY=your_encryption_key_32chars
```

## Installation

```bash
# Clone repository
git clone <repository-url>
cd backend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env
# Edit .env with your credentials

# Start MongoDB
mongod

# Start PostgreSQL
# Ensure PostgreSQL is running

# Start Redis
redis-server

# Run database migrations (if using PostgreSQL)
npm run migrate

# Seed initial data (optional)
npm run seed

# Start development server
npm run dev
```

## Development Commands

```bash
# Development with hot reload
npm run dev

# Production
npm start

# Run tests
npm test

# Test with coverage
npm run test:coverage

# Lint
npm run lint

# Format
npm run format

# Database migrations
npm run migrate
npm run migrate:rollback
```

## WebSocket Events (Real-time Updates)

### Client → Server
```javascript
// Connect with auth token
socket.emit('authenticate', { token: 'JWT_TOKEN' });

// Subscribe to product performance
socket.emit('subscribe:product', { productId: 'product_id' });

// Subscribe to investment updates
socket.emit('subscribe:investment', { investmentId: 'investment_id' });
```

### Server → Client
```javascript
// Performance update
socket.on('performance:update', (data) => {
  // { productId, roi, percentageChange, timestamp }
});

// Investment update
socket.on('investment:update', (data) => {
  // { investmentId, currentROI, roiEarned, percentageChange }
});

// Wallet update
socket.on('wallet:update', (data) => {
  // { balance, lastTransaction }
});

// Notification
socket.on('notification', (data) => {
  // { title, message, type, data }
});
```

## Payment Integration

### Paystack Flow
1. Client initiates funding → `/api/v1/wallet/fund/paystack`
2. Backend generates payment link
3. Client completes payment
4. Paystack webhook → `/api/v1/webhooks/paystack`
5. Backend verifies and credits wallet

### PalmPay Flow
1. Client initiates funding → `/api/v1/wallet/fund/palmpay`
2. Backend generates payment reference
3. Client completes payment in PalmPay app
4. PalmPay webhook → `/api/v1/webhooks/palmpay`
5. Backend credits wallet

### Bank Transfer Flow
1. Client requests virtual account → `/api/v1/wallet/fund/bank-transfer`
2. Backend returns virtual account details (Monnify)
3. Client transfers to virtual account
4. Monnify webhook → `/api/v1/webhooks/monnify`
5. Backend credits wallet

## KYC Integration (Smile Identity)

```javascript
// BVN Verification
await kycService.verifyBVN({
  bvn: '22234567890',
  firstName: 'John',
  lastName: 'Doe',
  dateOfBirth: '1990-01-01'
});

// NIN Verification
await kycService.verifyNIN({
  nin: '12345678901',
  firstName: 'John',
  lastName: 'Doe'
});
```

## Security Features
- JWT authentication with refresh tokens
- Password hashing (bcrypt)
- Transaction PIN for withdrawals
- 2FA (optional)
- BVN/NIN encryption at rest
- Rate limiting (prevent brute force)
- Input validation and sanitization
- CORS configuration
- Helmet.js security headers
- Request logging and monitoring
- Fraud detection (unusual transaction patterns)

## Performance Requirements
- Wallet funding/withdrawal: < 5 seconds
- API response time: < 500ms (95th percentile)
- WebSocket latency: < 100ms
- Uptime: 99.9%
- Concurrent users: 10,000+

## Deployment

### Recommended Platforms
- AWS (EC2, ECS, Lambda)
- Google Cloud Platform
- DigitalOcean
- Railway
- Render

### Production Checklist
- [ ] SSL/TLS certificates
- [ ] Environment variables configured
- [ ] Database backups enabled
- [ ] Redis persistence enabled
- [ ] Error monitoring (Sentry)
- [ ] Logging (Winston + CloudWatch)
- [ ] Load balancing
- [ ] Auto-scaling configured
- [ ] CDN for static assets
- [ ] Webhook retry mechanism

## Regulatory Compliance (Nigeria)
- KYC/AML compliance via BVN/NIN verification
- Transaction limits for unverified users (₦100,000)
- Higher limits for verified users
- Transaction monitoring and reporting
- Data protection (NDPR compliance)
- Secure storage of sensitive information

## Contributing
Please read CONTRIBUTING.md for details on our code of conduct and the process for submitting pull requests.

## License
MIT

## Support
For issues and questions, please open an issue on GitHub or contact support@nestly.com
