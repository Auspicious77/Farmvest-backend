# Nestly Backend Installation & Setup Guide

## 📋 Prerequisites

Before you begin, ensure you have the following installed:
- **Node.js** (v18 or higher) - [Download](https://nodejs.org/)
- **MongoDB** (v6 or higher) - [Download](https://www.mongodb.com/try/download/community)
- **Redis** (v7 or higher) - [Download](https://redis.io/download/)
- **Git** - [Download](https://git-scm.com/downloads)

## 🚀 Installation Steps

### 1. Navigate to Backend Directory
```bash
cd backend
```

### 2. Install Dependencies
```bash
npm install
```

This will install all required packages including:
- Express.js (web framework)
- Mongoose (MongoDB ODM)
- Socket.io (real-time updates)
- JWT (authentication)
- Nodemailer (email service)
- And more...

### 3. Setup Environment Variables
```bash
cp .env.example .env
```

Then edit `.env` and fill in your credentials:

#### Required Configuration:
```env
# Database
MONGODB_URI=mongodb://localhost:27017/nestly

# JWT Secrets (generate secure random strings)
JWT_SECRET=your_secure_jwt_secret_minimum_32_characters_long
JWT_REFRESH_SECRET=your_refresh_secret_minimum_32_characters_long

# Encryption Key (32 characters)
ENCRYPTION_KEY=your_32_character_encryption_key

# Email (Gmail example)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_gmail_app_password
EMAIL_FROM=noreply@nestly.com
```

#### Optional (for full functionality):
- Payment gateways (Paystack, PalmPay, Monnify)
- KYC verification (Smile Identity)
- File storage (AWS S3 or Cloudinary)
- Push notifications (FCM)

### 4. Start Required Services

#### Start MongoDB:
```bash
# macOS (if installed via Homebrew)
brew services start mongodb-community

# Or run directly
mongod
```

#### Start Redis:
```bash
# macOS (if installed via Homebrew)
brew services start redis

# Or run directly
redis-server
```

### 5. Create Logs Directory
```bash
mkdir -p logs
```

### 6. Start Development Server
```bash
npm run dev
```

You should see:
```
✅ MongoDB Connected: localhost
✅ Redis connected
✅ Email server is ready
✅ Socket.io initialized
🚀 Server running in development mode on port 5000
```

## 🧪 Test the API

### Health Check:
```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "Nestly API is running",
  "timestamp": "2025-11-05T...",
  "environment": "development"
}
```

### Test Registration:
```bash
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "John Doe",
    "email": "john@example.com",
    "phone": "08012345678",
    "password": "Test1234"
  }'
```

## 📁 Project Status

### ✅ Completed Features:
1. **Project Structure** - All folders and files created
2. **Database Models** - User, Product, Investment, Wallet, Transaction, Notification, Recommendation
3. **Authentication System** - Register, login, email verification, password reset, JWT tokens
4. **Middleware** - Auth, validation, error handling
5. **Utilities** - Logger, JWT, encryption, helpers
6. **Email Service** - Nodemailer with templates
7. **Socket.io** - Real-time WebSocket infrastructure
8. **API Routes Structure** - All route files created

### 🚧 To Be Implemented (Next Phase):

#### Controllers & Services:
- [ ] User management (profile, KYC, transaction PIN)
- [ ] Wallet operations (fund, withdraw, transactions)
- [ ] Product management (CRUD, performance updates)
- [ ] Investment operations (create, track, complete)
- [ ] Payment gateway integration (Paystack, PalmPay, Monnify)
- [ ] KYC verification service (Smile Identity)
- [ ] Admin operations (user/product/transaction management)
- [ ] Analytics service
- [ ] Recommendation engine
- [ ] Push notifications service

#### Integration Services:
- [ ] Paystack payment integration
- [ ] PalmPay payment integration
- [ ] Monnify virtual accounts
- [ ] Smile Identity KYC verification
- [ ] AWS S3 / Cloudinary file upload
- [ ] FCM push notifications

## 🔧 Development Commands

```bash
# Start development server (with auto-reload)
npm run dev

# Start production server
npm start

# Run tests
npm test

# Run linter
npm run lint

# Format code
npm run format
```

## 📊 Database Setup

The application will automatically create collections in MongoDB when needed. No manual database setup required!

To view your database:
```bash
# Connect to MongoDB
mongosh

# Switch to nestly database
use nestly

# Show collections
show collections

# View users
db.users.find()
```

## 🔐 Generating Secure Keys

For production, generate secure random keys:

### JWT Secret (32+ characters):
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### Encryption Key (32 characters):
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

## 📧 Email Setup (Gmail)

1. Go to your Google Account settings
2. Enable 2-Factor Authentication
3. Generate an App Password:
   - Go to Security > 2-Step Verification > App passwords
   - Select "Mail" and "Other (Custom name)"
   - Copy the generated password
4. Use this password in `.env` as `SMTP_PASS`

## 🐛 Troubleshooting

### MongoDB Connection Failed:
```bash
# Check if MongoDB is running
brew services list  # macOS
ps aux | grep mongod  # Linux

# Start MongoDB
brew services start mongodb-community
```

### Redis Connection Failed:
```bash
# Check if Redis is running
redis-cli ping  # Should return PONG

# Start Redis
brew services start redis
```

### Port 5000 Already in Use:
```bash
# Kill process on port 5000
lsof -ti:5000 | xargs kill -9

# Or change port in .env
PORT=3000
```

## 📝 Next Steps

1. **Complete Implementation**: 
   - Work through remaining controllers and services
   - Implement payment gateway integrations
   - Add KYC verification

2. **Testing**:
   - Write unit tests for all services
   - Integration tests for API endpoints
   - Test payment flows

3. **Documentation**:
   - API documentation with Swagger
   - Postman collection

4. **Security**:
   - Rate limiting per endpoint
   - Input sanitization
   - SQL/NoSQL injection prevention
   - CORS configuration

## 🤝 Need Help?

If you encounter any issues:
1. Check the logs in `logs/` directory
2. Verify all environment variables are set
3. Ensure all services (MongoDB, Redis) are running
4. Check Node.js version: `node --version` (should be 18+)

## 📚 Documentation

- [Express.js Docs](https://expressjs.com/)
- [Mongoose Docs](https://mongoosejs.com/)
- [Socket.io Docs](https://socket.io/docs/)
- [JWT Docs](https://jwt.io/)

---

**Status**: Backend foundation is complete and ready for development! ✅

The authentication system is fully functional. Next, we'll implement:
1. User management features
2. Wallet system with payment integrations
3. Product and investment management
4. Admin features
5. Real-time updates via WebSocket

Let me know when you're ready to continue!
