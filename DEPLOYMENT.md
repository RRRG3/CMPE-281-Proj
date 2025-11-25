# Cloud Deployment Guide - Smart Home Care Alert Monitoring System

## Overview

This guide covers deploying your Alert Monitoring System to the cloud with multiple deployment options.

## Architecture Components

Your application consists of:
- **Frontend**: Static HTML/CSS/JS files (Vite project)
- **Backend API**: Node.js/Express server
- **Databases**: PostgreSQL (relational) + MongoDB (time-series)
- **Real-time**: WebSocket server

---

## Option 1: AWS Deployment (Recommended for Production)

### Architecture
```
CloudFront (CDN) → S3 (Frontend)
                ↓
Application Load Balancer → ECS/Fargate (Backend)
                ↓
RDS PostgreSQL + DocumentDB (MongoDB-compatible)
```

### Step-by-Step AWS Deployment

#### 1. Frontend Deployment (S3 + CloudFront)

**Build the frontend:**
```bash
cd vite-project
npm install
npm run build
```

**Deploy to S3:**
```bash
# Create S3 bucket
aws s3 mb s3://smart-home-care-frontend

# Upload build files
aws s3 sync dist/ s3://smart-home-care-frontend --acl public-read

# Enable static website hosting
aws s3 website s3://smart-home-care-frontend --index-document index.html
```

**Setup CloudFront CDN:**
```bash
# Create CloudFront distribution (via AWS Console or CLI)
# Point origin to S3 bucket
# Enable HTTPS with ACM certificate
```

#### 2. Backend Deployment (ECS Fargate)

**Create Dockerfile:**
```dockerfile
# See Dockerfile below
```

**Push to ECR:**
```bash
# Create ECR repository
aws ecr create-repository --repository-name smart-home-care-api

# Build and push Docker image
docker build -t smart-home-care-api ./server
docker tag smart-home-care-api:latest <account-id>.dkr.ecr.<region>.amazonaws.com/smart-home-care-api:latest
docker push <account-id>.dkr.ecr.<region>.amazonaws.com/smart-home-care-api:latest
```

**Deploy to ECS:**
- Create ECS cluster
- Create task definition with environment variables
- Create service with Application Load Balancer
- Configure auto-scaling

#### 3. Database Setup

**PostgreSQL (RDS):**
```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier smart-home-care-db \
  --db-instance-class db.t3.medium \
  --engine postgres \
  --master-username admin \
  --master-user-password <password> \
  --allocated-storage 20
```

**MongoDB (DocumentDB):**
```bash
# Create DocumentDB cluster
aws docdb create-db-cluster \
  --db-cluster-identifier smart-home-care-mongo \
  --engine docdb \
  --master-username admin \
  --master-user-password <password>
```

#### 4. Environment Variables (AWS Systems Manager)

Store secrets in Parameter Store:
```bash
aws ssm put-parameter --name /smartcare/DB_URL --value "postgresql://..." --type SecureString
aws ssm put-parameter --name /smartcare/MONGO_URL --value "mongodb://..." --type SecureString
aws ssm put-parameter --name /smartcare/JWT_SECRET --value "..." --type SecureString
```

---

## Option 2: Vercel + Railway (Easiest for Quick Deploy)

### Frontend on Vercel

**1. Install Vercel CLI:**
```bash
npm install -g vercel
```

**2. Deploy:**
```bash
cd vite-project
vercel --prod
```

**3. Configure:**
- Set build command: `npm run build`
- Set output directory: `dist`
- Add environment variables in Vercel dashboard

### Backend on Railway

**1. Install Railway CLI:**
```bash
npm install -g @railway/cli
```

**2. Deploy:**
```bash
cd vite-project/server
railway login
railway init
railway up
```

**3. Add Databases:**
- Add PostgreSQL plugin in Railway dashboard
- Add MongoDB plugin in Railway dashboard
- Railway auto-configures connection strings

---

## Option 3: DigitalOcean App Platform (Balanced)

### Single Configuration File

Create `app.yaml`:
```yaml
name: smart-home-care
services:
  # Frontend
  - name: frontend
    github:
      repo: your-username/smart-home-care
      branch: main
      deploy_on_push: true
    build_command: cd vite-project && npm install && npm run build
    output_dir: vite-project/dist
    routes:
      - path: /
    
  # Backend API
  - name: api
    github:
      repo: your-username/smart-home-care
      branch: main
      deploy_on_push: true
    source_dir: vite-project/server
    build_command: npm install
    run_command: node index.js
    envs:
      - key: PORT
        value: "8080"
      - key: DB_URL
        value: ${db.DATABASE_URL}
      - key: MONGO_URL
        value: ${mongo.DATABASE_URL}
    routes:
      - path: /api

databases:
  - name: db
    engine: PG
    version: "14"
  
  - name: mongo
    engine: MONGODB
    version: "5"
```

**Deploy:**
```bash
doctl apps create --spec app.yaml
```

---

## Option 4: Heroku (Simple but Costly)

### Deploy Backend

```bash
cd vite-project/server
heroku create smart-home-care-api
heroku addons:create heroku-postgresql:mini
heroku addons:create mongolab:sandbox
git push heroku main
```

### Deploy Frontend

```bash
cd vite-project
heroku create smart-home-care-frontend
heroku buildpacks:set heroku/nodejs
git push heroku main
```

---

## Required Files for Deployment

### 1. Dockerfile (Backend)

Create `vite-project/server/Dockerfile`:
```dockerfile
FROM node:18-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (r) => {process.exit(r.statusCode === 200 ? 0 : 1)})"

# Start application
CMD ["node", "index.js"]
```

### 2. Docker Compose (Local Testing)

Create `docker-compose.yml`:
```yaml
version: '3.8'

services:
  postgres:
    image: postgres:14-alpine
    environment:
      POSTGRES_DB: alert_monitoring
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: password
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data

  mongodb:
    image: mongo:5
    ports:
      - "27017:27017"
    volumes:
      - mongo_data:/data/db

  api:
    build: ./vite-project/server
    ports:
      - "3000:3000"
    environment:
      DB_URL: postgresql://postgres:password@postgres:5432/alert_monitoring
      MONGO_URL: mongodb://mongodb:27017/alert_monitoring
      JWT_SECRET: your-secret-key-here
      NODE_ENV: production
    depends_on:
      - postgres
      - mongodb

volumes:
  postgres_data:
  mongo_data:
```

### 3. GitHub Actions CI/CD

Create `.github/workflows/deploy.yml`:
```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '18'
      
      - name: Build Frontend
        run: |
          cd vite-project
          npm ci
          npm run build
      
      - name: Deploy to S3
        uses: jakejarvis/s3-sync-action@master
        with:
          args: --acl public-read --follow-symlinks --delete
        env:
          AWS_S3_BUCKET: ${{ secrets.AWS_S3_BUCKET }}
          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}
          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          SOURCE_DIR: 'vite-project/dist'

  deploy-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v1
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: us-east-1
      
      - name: Login to Amazon ECR
        id: login-ecr
        uses: aws-actions/amazon-ecr-login@v1
      
      - name: Build and push Docker image
        env:
          ECR_REGISTRY: ${{ steps.login-ecr.outputs.registry }}
          ECR_REPOSITORY: smart-home-care-api
          IMAGE_TAG: ${{ github.sha }}
        run: |
          cd vite-project/server
          docker build -t $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG .
          docker push $ECR_REGISTRY/$ECR_REPOSITORY:$IMAGE_TAG
      
      - name: Deploy to ECS
        run: |
          aws ecs update-service --cluster smart-home-care --service api --force-new-deployment
```

### 4. Health Check Endpoint

Add to `vite-project/server/index.js`:
```javascript
// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});
```

---

## Environment Variables Checklist

Required environment variables for production:

```bash
# Database
DB_URL=postgresql://user:pass@host:5432/dbname
MONGO_URL=mongodb://host:27017/dbname

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this

# Email (Optional)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=alerts@yourdomain.com
SMTP_PASS=your-app-password

# SMS (Optional - Twilio)
TWILIO_ACCOUNT_SID=your-account-sid
TWILIO_AUTH_TOKEN=your-auth-token
TWILIO_PHONE=+1234567890

# Server
PORT=3000
NODE_ENV=production

# CORS (Frontend URL)
FRONTEND_URL=https://yourdomain.com
```

---

## Post-Deployment Checklist

- [ ] SSL/TLS certificates configured
- [ ] Environment variables set
- [ ] Database migrations run
- [ ] Seed data loaded (if needed)
- [ ] CORS configured for frontend domain
- [ ] Health checks passing
- [ ] Monitoring/logging configured
- [ ] Backup strategy in place
- [ ] CDN cache configured
- [ ] DNS records updated

---

## Monitoring & Logging

### AWS CloudWatch
```javascript
// Add to server
import winston from 'winston';
import CloudWatchTransport from 'winston-cloudwatch';

const logger = winston.createLogger({
  transports: [
    new CloudWatchTransport({
      logGroupName: '/aws/ecs/smart-home-care',
      logStreamName: 'api',
      awsRegion: 'us-east-1'
    })
  ]
});
```

### Error Tracking (Sentry)
```javascript
import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

---

## Cost Estimates

### AWS (Monthly)
- S3 + CloudFront: $5-20
- ECS Fargate (2 tasks): $30-50
- RDS PostgreSQL (t3.medium): $50-80
- DocumentDB (t3.medium): $60-100
- **Total: ~$145-250/month**

### Vercel + Railway
- Vercel Pro: $20
- Railway (Hobby): $5-20
- **Total: ~$25-40/month**

### DigitalOcean
- App Platform (Basic): $12
- Managed PostgreSQL: $15
- Managed MongoDB: $15
- **Total: ~$42/month**

---

## Quick Start: Deploy in 5 Minutes

**Fastest option (Vercel + Railway):**

```bash
# 1. Deploy Frontend
cd vite-project
vercel --prod

# 2. Deploy Backend
cd server
railway login
railway init
railway up

# 3. Add databases in Railway dashboard
# 4. Update frontend API_BASE to Railway URL
# 5. Done!
```

---

## Need Help?

- AWS: https://docs.aws.amazon.com/
- Vercel: https://vercel.com/docs
- Railway: https://docs.railway.app/
- DigitalOcean: https://docs.digitalocean.com/

