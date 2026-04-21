# Nestly Backend - Quick Reference Guide

## 🚀 Getting Started

### Installation (5 minutes)
```bash
cd backend
npm install
cp .env.example .env
# Edit .env with your credentials
npm run dev
```

### First API Call
```bash
# Register a user
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "fullName": "Test User",
    "email": "test@example.com",
    "phoneNumber": "+2348012345678",
    "password": "Test123!",
    "dateOfBirth": "1990-01-01"
  }'
```

---

## 📋 Common Tasks

### 1. Test Authentication Flow
```bash
# 1. Register
POST /api/v1/auth/register

# 2. Verify email (check terminal for OTP)
POST /api/v1/auth/verify-email
{ "email": "test@example.com", "otp": "123456" }

# 3. Login
POST /api/v1/auth/login
{ "email": "test@example.com", "password": "Test123!" }

# 4. Use returned token in all requests
Authorization: Bearer <your_token>
```

### 2. Fund Wallet
```bash
# Option A: Get virtual account
GET /api/v1/wallet/fund/bank-transfer
# Transfer to returned account number

# Option B: Card payment via Paystack
POST /api/v1/wallet/fund/paystack
{ "amount": 10000 }
# Visit returned authorizationUrl
```

### 3. Create Investment
```bash
# 1. Get available products
GET /api/v1/products?status=open

# 2. Create investment
POST /api/v1/investments
{
  "productId": "product_id_here",
  "amount": 50000,
  "pin": "123456"
}
```

### 4. Admin: Update Product Performance (Daily)
```bash
POST /api/v1/products/:id/performance
Authorization: Bearer <admin_token>
{
  "roi": 18.5,
  "marketValue": 1200000,
  "notes": "Strong market demand"
}
# This updates all active investments automatically
```

---

## 🔑 API Authentication

### Get Token
```javascript
const response = await fetch('http://localhost:5000/api/v1/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'test@example.com',
    password: 'Test123!'
  })
});
const { data } = await response.json();
const token = data.accessToken;
```

### Use Token
```javascript
fetch('http://localhost:5000/api/v1/wallet', {
  headers: { 'Authorization': `Bearer ${token}` }
});
```

---

## 💾 Database Quick Access

### MongoDB
```bash
# Connect
mongosh "mongodb://localhost:27017/nestly"

# View users
db.users.find().pretty()

# View investments
db.investments.find().populate('product').pretty()

# Create admin user
db.users.updateOne(
  { email: 'admin@nestly.com' },
  { $set: { role: 'admin' } }
)
```

### Redis
```bash
# Connect
redis-cli

# View all keys
KEYS *

# Get cached value
GET user:cache:userId

# Clear cache
FLUSHDB
```

---

## 🧪 Testing Scenarios

### Scenario 1: Complete Investment Flow
1. Register user → Verify email → Login
2. Set transaction PIN
3. Fund wallet (₦100,000)
4. Browse products
5. Create investment (₦50,000)
6. View investment dashboard
7. Admin updates performance
8. Check real-time update via WebSocket
9. Wait for maturity
10. Auto-payout to wallet

### Scenario 2: KYC Upgrade Flow
1. Basic user (wallet limit ₦100k)
2. Verify BVN
3. Wallet tier upgraded to "verified"
4. Can now fund unlimited amounts

### Scenario 3: Withdrawal Flow
1. Fund wallet
2. Set transaction PIN
3. Add primary bank account
4. Request withdrawal
5. Admin approves
6. Paystack processes transfer
7. Webhook confirms success
8. Email notification sent

---

## 🔧 Debugging Tips

### Check Server Logs
```bash
# Real-time logs
pm2 logs nestly-api

# Or directly
tail -f logs/combined.log
tail -f logs/error.log
```

### Common Issues

**Issue: JWT Token Invalid**
```bash
# Solution: Check token expiry and refresh
POST /api/v1/auth/refresh-token
{ "refreshToken": "your_refresh_token" }
```

**Issue: Webhook Not Receiving**
```bash
# Solution: Use ngrok for local testing
ngrok http 5000
# Update Paystack/Monnify webhook URL to ngrok URL
```

**Issue: Email Not Sending**
```bash
# Solution: Check SMTP credentials in .env
# For Gmail, use App Password, not regular password
```

**Issue: Redis Connection Failed**
```bash
# Solution: Ensure Redis is running
redis-server
# Or use cloud Redis (Redis Labs, AWS ElastiCache)
```

---

## 📊 Monitoring

### Health Check
```bash
curl http://localhost:5000/health
```

### System Stats
```bash
# PM2 dashboard
pm2 monit

# Or view process info
pm2 info nestly-api
```

### Database Stats
```javascript
// MongoDB
db.stats()
db.serverStatus()

// Check indexes
db.users.getIndexes()
db.investments.getIndexes()
```

---

## 🔐 Security Checklist

- [ ] All `.env` files in `.gitignore`
- [ ] JWT secrets are strong random strings
- [ ] CORS configured for allowed origins only
- [ ] Rate limiting enabled (check with 100+ requests)
- [ ] Transaction PIN required for sensitive operations
- [ ] BVN/NIN encrypted in database
- [ ] HTTPS in production
- [ ] Webhook signatures verified

---

## 📱 Mobile Integration Tips

### WebSocket Connection (React Native)
```javascript
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  auth: { token: userToken }
});

socket.on('connect', () => {
  console.log('Connected to WebSocket');
});

socket.on('wallet_update', (data) => {
  // Update wallet balance in app
  updateWalletBalance(data.balance);
});

socket.on('performance_update', (data) => {
  // Update investment performance
  updatePerformance(data);
});
```

### Store Token Securely
```javascript
// Use react-native-keychain or expo-secure-store
import * as SecureStore from 'expo-secure-store';

await SecureStore.setItemAsync('accessToken', token);
const token = await SecureStore.getItemAsync('accessToken');
```

---

## 🎨 Frontend Integration Checklist

### Authentication
- [ ] Register form with validation
- [ ] Email verification with OTP input
- [ ] Login form
- [ ] Forgot password flow
- [ ] Biometric/Face ID option
- [ ] Auto-logout on token expiry

### Dashboard
- [ ] Wallet balance display
- [ ] Portfolio overview
- [ ] Recent transactions
- [ ] Active investments list
- [ ] Performance charts

### Products
- [ ] Product listing with filters
- [ ] Product details page
- [ ] Performance chart (real-time)
- [ ] Investment creation form
- [ ] Recommendations section

### Wallet
- [ ] Funding options (bank transfer, card, PalmPay)
- [ ] Virtual account display
- [ ] Transaction history
- [ ] Withdrawal form with PIN
- [ ] Transaction receipt

### Settings
- [ ] Profile management
- [ ] KYC verification flow
- [ ] Transaction PIN setup
- [ ] Bank account management
- [ ] Notification preferences
- [ ] Biometric settings

---

## 🚨 Emergency Procedures

### Rollback Deployment
```bash
cd /var/www/nestly-backend
git log --oneline # Find last good commit
git reset --hard <commit-hash>
pm2 restart nestly-api
```

### Stop All Transactions
```bash
# Disable all product investments
db.products.updateMany({}, { $set: { status: 'closed' } })

# Or stop server
pm2 stop nestly-api
```

### Database Backup (Emergency)
```bash
mongodump --uri="$MONGODB_URI" --out=/tmp/emergency-backup
tar -czf emergency-backup.tar.gz /tmp/emergency-backup
```

---

## 📞 Quick Contacts

- **Backend Issues**: Check logs first, then GitHub Issues
- **Payment Issues**: Check webhook logs, verify API keys
- **Email Issues**: Check SMTP settings, test with curl
- **Performance Issues**: Check Redis cache, database indexes

---

## 📚 Documentation Links

- [Full API Documentation](./API_DOCUMENTATION.md)
- [Installation Guide](./INSTALLATION.md)
- [Deployment Guide](./DEPLOYMENT.md)
- [Implementation Summary](./IMPLEMENTATION_SUMMARY.md)

---

## 💡 Pro Tips

1. **Use Postman Collections**: Export API endpoints for team sharing
2. **Enable MongoDB Compass**: Visual database management
3. **Use Redis Desktop Manager**: View cached data easily
4. **Set up Error Tracking**: Sentry or Rollbar for production
5. **Mock Payment Gateways**: Use test keys during development
6. **Automate Database Backups**: Daily cron job
7. **Monitor Webhook Failures**: Set up alerts for failed webhooks
8. **Test Email Templates**: Send to yourself before production

---

**Last Updated**: November 5, 2025  
**Version**: 1.0.0  
**Status**: Production Ready ✅
