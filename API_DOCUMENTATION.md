# Nestly API Documentation

## Base URL
```
Development: http://localhost:5000/api/v1
Production: https://api.nestly.com/api/v1
```

## Authentication
Most endpoints require authentication using JWT tokens. Include the token in the Authorization header:
```
Authorization: Bearer <your_token>
```

---

## Table of Contents
1. [Authentication](#authentication-endpoints)
2. [User Management](#user-management)
3. [Wallet Operations](#wallet-operations)
4. [Products](#products)
5. [Investments](#investments)
6. [Notifications](#notifications)
7. [Admin](#admin-endpoints)
8. [Webhooks](#webhooks)

---

## Authentication Endpoints

### Register User
```http
POST /auth/register
Content-Type: application/json

{
  "fullName": "John Doe",
  "email": "john@example.com",
  "phoneNumber": "+2348012345678",
  "password": "SecurePass123!",
  "dateOfBirth": "1990-01-01"
}
```

### Verify Email
```http
POST /auth/verify-email
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456"
}
```

### Login
```http
POST /auth/login
Content-Type: application/json

{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

### Refresh Token
```http
POST /auth/refresh-token
Content-Type: application/json

{
  "refreshToken": "your_refresh_token"
}
```

### Forgot Password
```http
POST /auth/forgot-password
Content-Type: application/json

{
  "email": "john@example.com"
}
```

### Reset Password
```http
POST /auth/reset-password
Content-Type: application/json

{
  "email": "john@example.com",
  "otp": "123456",
  "newPassword": "NewSecurePass123!"
}
```

---

## User Management

### Get Profile
```http
GET /users/profile
Authorization: Bearer <token>
```

### Update Profile
```http
PATCH /users/profile
Authorization: Bearer <token>
Content-Type: application/json

{
  "fullName": "John Updated Doe",
  "address": "123 Main St, Lagos"
}
```

### Verify BVN
```http
POST /users/verify-bvn
Authorization: Bearer <token>
Content-Type: application/json

{
  "bvn": "12345678901",
  "dateOfBirth": "1990-01-01"
}
```

### Verify NIN
```http
POST /users/verify-nin
Authorization: Bearer <token>
Content-Type: application/json

{
  "nin": "12345678901",
  "dateOfBirth": "1990-01-01"
}
```

### Set Transaction PIN
```http
POST /users/transaction-pin
Authorization: Bearer <token>
Content-Type: application/json

{
  "pin": "123456",
  "currentPassword": "SecurePass123!"
}
```

### Update Transaction PIN
```http
PATCH /users/transaction-pin
Authorization: Bearer <token>
Content-Type: application/json

{
  "oldPin": "123456",
  "newPin": "654321"
}
```

### Update Primary Bank Account
```http
PATCH /users/bank-account
Authorization: Bearer <token>
Content-Type: application/json

{
  "accountNumber": "0123456789",
  "bankCode": "057",
  "accountName": "John Doe"
}
```

---

## Wallet Operations

### Get Wallet
```http
GET /wallet
Authorization: Bearer <token>
```

### Get Virtual Account Details
```http
GET /wallet/fund/bank-transfer
Authorization: Bearer <token>
```

### Fund via Paystack
```http
POST /wallet/fund/paystack
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 10000
}
```

### Withdraw Funds
```http
POST /wallet/withdraw
Authorization: Bearer <token>
Content-Type: application/json

{
  "amount": 5000,
  "pin": "123456"
}
```

### Get Transactions
```http
GET /wallet/transactions?page=1&limit=20&type=funding&status=completed
Authorization: Bearer <token>
```

### Get Transaction by ID
```http
GET /wallet/transactions/:id
Authorization: Bearer <token>
```

### Get Banks List
```http
GET /wallet/banks
Authorization: Bearer <token>
```

### Resolve Account Number
```http
GET /wallet/resolve-account?accountNumber=0123456789&bankCode=057
Authorization: Bearer <token>
```

---

## Products

### Get All Products
```http
GET /products?page=1&limit=10&category=poultry&status=open
```

### Get Featured Products
```http
GET /products/featured
```

### Get Product by ID
```http
GET /products/:id
```

### Get Product Performance
```http
GET /products/:id/performance?days=30
```

### Get Recommendations (Authenticated)
```http
GET /products/recommendations/me
Authorization: Bearer <token>
```

### Create Product (Admin)
```http
POST /products
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "name": "Broiler Chicken Farm",
  "description": "Commercial broiler chicken farming",
  "category": "poultry",
  "duration": 4,
  "minInvestment": 50000,
  "maxInvestment": 1000000,
  "maxInvestors": 50,
  "roiRange": {
    "min": 15,
    "max": 25
  },
  "riskLevel": "medium",
  "farmLocation": "Ogun State",
  "isFeatured": true
}
```

### Update Product Performance (Admin)
```http
POST /products/:id/performance
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "roi": 18.5,
  "marketValue": 1200000,
  "notes": "Strong market demand"
}
```

### Toggle Product Status (Admin)
```http
PATCH /products/:id/toggle-status
Authorization: Bearer <admin_token>
```

---

## Investments

### Get My Investments
```http
GET /investments?page=1&limit=10&status=active
Authorization: Bearer <token>
```

### Get Investment Summary
```http
GET /investments/summary
Authorization: Bearer <token>
```

### Get Investment by ID
```http
GET /investments/:id
Authorization: Bearer <token>
```

### Get Investment Performance
```http
GET /investments/:id/performance?days=30
Authorization: Bearer <token>
```

### Create Investment
```http
POST /investments
Authorization: Bearer <token>
Content-Type: application/json

{
  "productId": "product_id_here",
  "amount": 50000,
  "pin": "123456"
}
```

### Get All Investments (Admin)
```http
GET /investments/admin/all?page=1&limit=20&status=active
Authorization: Bearer <admin_token>
```

### Complete Investment (Admin)
```http
POST /investments/admin/:id/complete
Authorization: Bearer <admin_token>
```

### Auto-Complete Matured Investments (Admin/Cron)
```http
POST /investments/admin/auto-complete
Authorization: Bearer <admin_token>
```

---

## Notifications

### Get My Notifications
```http
GET /notifications?page=1&limit=20&isRead=false
Authorization: Bearer <token>
```

### Mark as Read
```http
PATCH /notifications/:id/read
Authorization: Bearer <token>
```

### Mark All as Read
```http
PATCH /notifications/mark-all-read
Authorization: Bearer <token>
```

### Delete Notification
```http
DELETE /notifications/:id
Authorization: Bearer <token>
```

### Get Notification Preferences
```http
GET /notifications/preferences
Authorization: Bearer <token>
```

### Update Notification Preferences
```http
PATCH /notifications/preferences
Authorization: Bearer <token>
Content-Type: application/json

{
  "email": true,
  "push": true,
  "sms": false
}
```

### Send to Specific User (Admin)
```http
POST /notifications/send-to-user
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "userId": "user_id_here",
  "title": "Important Notice",
  "message": "Your message here",
  "type": "system"
}
```

### Broadcast Notification (Admin)
```http
POST /notifications/broadcast
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "title": "System Maintenance",
  "message": "Scheduled maintenance on...",
  "type": "system",
  "userFilter": {
    "kycStatus": "verified"
  }
}
```

---

## Admin Endpoints

### Get Dashboard Analytics
```http
GET /admin/dashboard?period=30
Authorization: Bearer <admin_token>
```

### Get System Statistics
```http
GET /admin/statistics?startDate=2024-01-01&endDate=2024-12-31
Authorization: Bearer <admin_token>
```

### Get All Users
```http
GET /admin/users?page=1&limit=20&kycStatus=pending&search=john
Authorization: Bearer <admin_token>
```

### Get User Details
```http
GET /admin/users/:id
Authorization: Bearer <admin_token>
```

### Update User KYC Status
```http
PATCH /admin/users/:id/kyc
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "kycStatus": "verified",
  "reason": "All documents verified"
}
```

### Toggle User Status
```http
PATCH /admin/users/:id/toggle-status
Authorization: Bearer <admin_token>
```

### Get Pending Withdrawals
```http
GET /admin/withdrawals/pending?page=1&limit=20
Authorization: Bearer <admin_token>
```

### Process Withdrawal
```http
POST /admin/withdrawals/:id/process
Authorization: Bearer <admin_token>
Content-Type: application/json

{
  "action": "approve",
  "reason": "Approved after verification"
}
```

---

## Webhooks

### Paystack Webhook
```http
POST /webhooks/paystack
X-Paystack-Signature: signature_here
Content-Type: application/json

{
  "event": "charge.success",
  "data": {
    "reference": "ref_123",
    "amount": 1000000,
    ...
  }
}
```

### Monnify Webhook
```http
POST /webhooks/monnify
Monnify-Signature: signature_here
Content-Type: application/json

{
  "eventType": "SUCCESSFUL_TRANSACTION",
  "eventData": {
    "transactionReference": "ref_123",
    "amountPaid": 10000,
    ...
  }
}
```

---

## Response Format

### Success Response
```json
{
  "success": true,
  "message": "Operation successful",
  "data": {
    // Response data
  }
}
```

### Error Response
```json
{
  "success": false,
  "message": "Error message",
  "error": "Detailed error description",
  "stack": "Error stack (development only)"
}
```

### Pagination Response
```json
{
  "success": true,
  "data": {
    "items": [],
    "pagination": {
      "total": 100,
      "page": 1,
      "limit": 20,
      "totalPages": 5
    }
  }
}
```

---

## Error Codes

- `400` - Bad Request (validation errors)
- `401` - Unauthorized (missing or invalid token)
- `403` - Forbidden (insufficient permissions)
- `404` - Not Found
- `409` - Conflict (duplicate resource)
- `429` - Too Many Requests (rate limit exceeded)
- `500` - Internal Server Error

---

## Rate Limiting

- Authentication endpoints: 5 requests per 15 minutes
- General API: 100 requests per 15 minutes
- Admin endpoints: 200 requests per 15 minutes

---

## WebSocket Events

Connect to Socket.io server for real-time updates:

```javascript
const socket = io('http://localhost:5000', {
  auth: { token: 'your_jwt_token' }
});

// Listen for events
socket.on('performance_update', (data) => {
  console.log('Performance update:', data);
});

socket.on('wallet_update', (data) => {
  console.log('Wallet update:', data);
});

socket.on('new_notification', (data) => {
  console.log('New notification:', data);
});
```

---

## Postman Collection

Import the Postman collection for easy API testing:
[Download Collection](./postman_collection.json)

---

## Support

For API support, contact: support@nestly.com
