# Nestly Backend Deployment Guide

## Prerequisites

- Node.js v18 or higher
- MongoDB (local or cloud instance like MongoDB Atlas)
- Redis (local or cloud instance like Redis Cloud)
- Domain name (for production)
- SSL certificate
- Payment gateway accounts (Paystack, Monnify)
- Smile Identity API credentials (for KYC)
- SMTP server for emails

---

## Environment Setup

### 1. Clone Repository
```bash
git clone <repository-url>
cd backend
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root directory:

```env
# Server Configuration
NODE_ENV=production
PORT=5000
CLIENT_URL=https://nestly.com
ADMIN_URL=https://admin.nestly.com

# Database
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/nestly?retryWrites=true&w=majority
REDIS_URL=redis://username:password@redis-host:6379

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_REFRESH_SECRET=your-refresh-token-secret-key
JWT_EXPIRE=7d
JWT_REFRESH_EXPIRE=30d

# Email Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@nestly.com

# Payment Gateways
PAYSTACK_SECRET_KEY=sk_live_xxxxxxxxxxxxx
PAYSTACK_PUBLIC_KEY=pk_live_xxxxxxxxxxxxx

MONNIFY_API_KEY=your_monnify_api_key
MONNIFY_SECRET_KEY=your_monnify_secret_key
MONNIFY_CONTRACT_CODE=your_contract_code
MONNIFY_BASE_URL=https://api.monnify.com

PALMPAY_API_KEY=your_palmpay_api_key
PALMPAY_SECRET_KEY=your_palmpay_secret_key

# KYC Verification
SMILE_API_KEY=your_smile_identity_api_key
SMILE_PARTNER_ID=your_partner_id
SMILE_BASE_URL=https://api.smileidentity.com/v1

# File Upload (AWS S3 or Cloudinary)
AWS_ACCESS_KEY_ID=your_aws_access_key
AWS_SECRET_ACCESS_KEY=your_aws_secret_key
AWS_REGION=us-east-1
AWS_BUCKET_NAME=nestly-uploads

# Or use Cloudinary
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret

# Security
ENCRYPTION_KEY=your-32-character-encryption-key
CORS_ORIGIN=https://nestly.com,https://admin.nestly.com

# Rate Limiting
RATE_LIMIT_WINDOW=15
RATE_LIMIT_MAX_REQUESTS=100
```

---

## Production Deployment

### Option 1: Deploy to VPS (Ubuntu Server)

#### 1. Install Node.js
```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

#### 2. Install MongoDB
```bash
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu focal/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt-get update
sudo apt-get install -y mongodb-org
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 3. Install Redis
```bash
sudo apt update
sudo apt install redis-server
sudo systemctl start redis
sudo systemctl enable redis
```

#### 4. Install PM2 (Process Manager)
```bash
sudo npm install -g pm2
```

#### 5. Setup Application
```bash
# Clone repository
git clone <repository-url> /var/www/nestly-backend
cd /var/www/nestly-backend

# Install dependencies
npm install --production

# Create .env file
nano .env
# Paste environment variables

# Start with PM2
pm2 start server.js --name nestly-api
pm2 save
pm2 startup
```

#### 6. Configure Nginx as Reverse Proxy
```bash
sudo apt install nginx

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/nestly-api
```

Add this configuration:
```nginx
server {
    listen 80;
    server_name api.nestly.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }

    # WebSocket support
    location /socket.io/ {
        proxy_pass http://localhost:5000/socket.io/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Enable the site:
```bash
sudo ln -s /etc/nginx/sites-available/nestly-api /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

#### 7. Setup SSL with Let's Encrypt
```bash
sudo apt install certbot python3-certbot-nginx
sudo certbot --nginx -d api.nestly.com
```

#### 8. Setup Firewall
```bash
sudo ufw allow 'Nginx Full'
sudo ufw allow OpenSSH
sudo ufw enable
```

---

### Option 2: Deploy to Heroku

#### 1. Install Heroku CLI
```bash
npm install -g heroku
```

#### 2. Login to Heroku
```bash
heroku login
```

#### 3. Create Heroku App
```bash
heroku create nestly-api
```

#### 4. Add MongoDB Add-on
```bash
heroku addons:create mongolab:sandbox
```

#### 5. Add Redis Add-on
```bash
heroku addons:create heroku-redis:hobby-dev
```

#### 6. Set Environment Variables
```bash
heroku config:set NODE_ENV=production
heroku config:set JWT_SECRET=your-secret
heroku config:set PAYSTACK_SECRET_KEY=your-key
# ... set all other environment variables
```

#### 7. Create Procfile
```bash
echo "web: node server.js" > Procfile
```

#### 8. Deploy
```bash
git add .
git commit -m "Deploy to Heroku"
git push heroku main
```

---

### Option 3: Deploy to AWS EC2

#### 1. Launch EC2 Instance
- Choose Ubuntu Server 22.04 LTS
- Instance type: t2.medium or higher
- Configure security group: Allow HTTP (80), HTTPS (443), SSH (22)

#### 2. Connect to Instance
```bash
ssh -i your-key.pem ubuntu@your-ec2-ip
```

#### 3. Follow VPS deployment steps (1-8 above)

#### 4. Optional: Use AWS RDS for MongoDB
- Create MongoDB Atlas cluster
- Whitelist EC2 IP address
- Update MONGODB_URI in .env

#### 5. Optional: Use AWS ElastiCache for Redis
- Create Redis cluster in ElastiCache
- Update REDIS_URL in .env

---

### Option 4: Deploy to DigitalOcean

#### 1. Create Droplet
- Choose Ubuntu 22.04
- Select plan (at least 2GB RAM recommended)
- Add SSH key

#### 2. Follow VPS deployment steps

#### 3. Optional: Use Managed Databases
```bash
# Create managed MongoDB and Redis databases in DigitalOcean
# Update connection strings in .env
```

---

## Docker Deployment

### 1. Create Dockerfile
```dockerfile
FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY . .

EXPOSE 5000

CMD ["node", "server.js"]
```

### 2. Create docker-compose.yml
```yaml
version: '3.8'

services:
  api:
    build: .
    ports:
      - "5000:5000"
    environment:
      - NODE_ENV=production
      - MONGODB_URI=mongodb://mongo:27017/nestly
      - REDIS_URL=redis://redis:6379
    depends_on:
      - mongo
      - redis
    restart: unless-stopped

  mongo:
    image: mongo:7.0
    volumes:
      - mongo-data:/data/db
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  mongo-data:
```

### 3. Deploy with Docker
```bash
docker-compose up -d
```

---

## Post-Deployment

### 1. Verify Installation
```bash
# Check server status
curl https://api.nestly.com/health

# Check PM2 status
pm2 status

# Check logs
pm2 logs nestly-api
```

### 2. Setup Monitoring

#### Install PM2 Monitoring
```bash
pm2 install pm2-logrotate
pm2 set pm2-logrotate:max_size 10M
pm2 set pm2-logrotate:retain 7
```

#### Setup New Relic (Optional)
```bash
npm install newrelic
# Configure with your New Relic license key
```

### 3. Setup Backup

#### MongoDB Backup Script
```bash
#!/bin/bash
# backup.sh
DATE=$(date +%Y%m%d_%H%M%S)
mongodump --uri="$MONGODB_URI" --out="/backups/mongodb_$DATE"
# Upload to S3
aws s3 cp /backups/mongodb_$DATE s3://nestly-backups/ --recursive
```

Add to crontab:
```bash
crontab -e
# Add: 0 2 * * * /path/to/backup.sh
```

### 4. Setup Alerts

Configure PM2 alerts:
```bash
pm2 install pm2-server-monit
```

### 5. Performance Optimization

#### Enable Compression
Already configured in app.js with compression middleware.

#### Setup CDN
Configure CloudFlare or AWS CloudFront for static assets.

#### Database Indexing
```javascript
// Already created in models, verify with:
db.users.getIndexes()
db.products.getIndexes()
db.investments.getIndexes()
```

---

## Maintenance

### Update Application
```bash
cd /var/www/nestly-backend
git pull origin main
npm install
pm2 restart nestly-api
```

### Check Logs
```bash
# PM2 logs
pm2 logs nestly-api

# Application logs
tail -f logs/combined.log
tail -f logs/error.log

# Nginx logs
sudo tail -f /var/log/nginx/access.log
sudo tail -f /var/log/nginx/error.log
```

### Database Maintenance
```bash
# MongoDB
mongo
use nestly
db.stats()
db.repairDatabase()

# Redis
redis-cli
INFO
FLUSHDB # Clear cache (use carefully)
```

---

## Scaling

### Horizontal Scaling (Multiple Instances)

#### 1. Use PM2 Cluster Mode
```bash
pm2 start server.js -i max --name nestly-api
```

#### 2. Load Balancer Configuration
```nginx
upstream nestly_backend {
    least_conn;
    server localhost:5000;
    server localhost:5001;
    server localhost:5002;
}

server {
    listen 80;
    server_name api.nestly.com;

    location / {
        proxy_pass http://nestly_backend;
    }
}
```

### Vertical Scaling
- Upgrade server resources (CPU, RAM)
- Optimize database queries
- Implement Redis caching
- Use CDN for static files

---

## Security Checklist

- ✅ Use HTTPS only
- ✅ Environment variables secured
- ✅ Rate limiting enabled
- ✅ CORS configured
- ✅ Helmet.js configured
- ✅ MongoDB sanitization enabled
- ✅ JWT tokens with expiration
- ✅ Password hashing with bcrypt
- ✅ Regular security updates
- ✅ Firewall configured
- ✅ SSH key authentication
- ✅ Regular backups
- ✅ Error logs monitored
- ✅ API keys in environment variables

---

## Troubleshooting

### Server won't start
```bash
# Check logs
pm2 logs nestly-api

# Check port availability
sudo lsof -i :5000

# Check environment variables
pm2 env 0
```

### Database connection issues
```bash
# Test MongoDB connection
mongosh "$MONGODB_URI"

# Test Redis connection
redis-cli -u "$REDIS_URL" ping
```

### High memory usage
```bash
# Check processes
pm2 monit

# Restart application
pm2 restart nestly-api --update-env
```

---

## Support

For deployment support, contact: devops@nestly.com
