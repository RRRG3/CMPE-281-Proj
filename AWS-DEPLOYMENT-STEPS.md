# AWS Deployment Steps - Smart Home Care System

## Prerequisites

- AWS Account with admin access
- AWS CLI installed and configured (`aws configure`)
- Docker installed locally
- Node.js 18+ installed

---

## Step 1: Set Up Databases

### PostgreSQL (RDS)

```bash
# Create RDS PostgreSQL instance
aws rds create-db-instance \
  --db-instance-identifier smart-home-care-db \
  --db-instance-class db.t3.micro \
  --engine postgres \
  --engine-version 14.7 \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --allocated-storage 20 \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name your-subnet-group \
  --publicly-accessible \
  --backup-retention-period 7

# Wait for instance to be available (5-10 minutes)
aws rds wait db-instance-available --db-instance-identifier smart-home-care-db

# Get endpoint
aws rds describe-db-instances \
  --db-instance-identifier smart-home-care-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text
```

### MongoDB (DocumentDB)

```bash
# Create DocumentDB cluster
aws docdb create-db-cluster \
  --db-cluster-identifier smart-home-care-mongo \
  --engine docdb \
  --master-username admin \
  --master-user-password YourSecurePassword123! \
  --vpc-security-group-ids sg-xxxxxxxxx \
  --db-subnet-group-name your-subnet-group

# Create instance
aws docdb create-db-instance \
  --db-instance-identifier smart-home-care-mongo-instance \
  --db-instance-class db.t3.medium \
  --engine docdb \
  --db-cluster-identifier smart-home-care-mongo

# Get endpoint
aws docdb describe-db-clusters \
  --db-cluster-identifier smart-home-care-mongo \
  --query 'DBClusters[0].Endpoint' \
  --output text
```

---

## Step 2: Create S3 Bucket for Frontend

```bash
# Create bucket
aws s3 mb s3://smart-home-care-frontend

# Enable static website hosting
aws s3 website s3://smart-home-care-frontend \
  --index-document index.html \
  --error-document index.html

# Set bucket policy for public read
cat > bucket-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Sid": "PublicReadGetObject",
      "Effect": "Allow",
      "Principal": "*",
      "Action": "s3:GetObject",
      "Resource": "arn:aws:s3:::smart-home-care-frontend/*"
    }
  ]
}
EOF

aws s3api put-bucket-policy \
  --bucket smart-home-care-frontend \
  --policy file://bucket-policy.json
```

---

## Step 3: Build and Deploy Frontend

```bash
# Build frontend
cd vite-project
npm install
npm run build

# Upload to S3
aws s3 sync dist/ s3://smart-home-care-frontend --delete

# Get website URL
echo "Frontend URL: http://smart-home-care-frontend.s3-website-us-east-1.amazonaws.com"
```

---

## Step 4: Create ECR Repository for Backend

```bash
# Create ECR repository
aws ecr create-repository --repository-name smart-home-care-api

# Get login command
aws ecr get-login-password --region us-east-1 | \
  docker login --username AWS --password-stdin \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com
```

---

## Step 5: Build and Push Docker Image

```bash
# Build Docker image
cd vite-project/server
docker build -t smart-home-care-api .

# Tag image
docker tag smart-home-care-api:latest \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/smart-home-care-api:latest

# Push to ECR
docker push \
  $(aws sts get-caller-identity --query Account --output text).dkr.ecr.us-east-1.amazonaws.com/smart-home-care-api:latest
```

---

## Step 6: Create ECS Cluster

```bash
# Create ECS cluster
aws ecs create-cluster --cluster-name smart-home-care

# Create CloudWatch log group
aws logs create-log-group --log-group-name /ecs/smart-home-care-api
```

---

## Step 7: Create IAM Role for ECS Task

```bash
# Create trust policy
cat > ecs-task-trust-policy.json << 'EOF'
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Principal": {
        "Service": "ecs-tasks.amazonaws.com"
      },
      "Action": "sts:AssumeRole"
    }
  ]
}
EOF

# Create IAM role
aws iam create-role \
  --role-name ecsTaskExecutionRole \
  --assume-role-policy-document file://ecs-task-trust-policy.json

# Attach policy
aws iam attach-role-policy \
  --role-name ecsTaskExecutionRole \
  --policy-arn arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy
```

---

## Step 8: Create ECS Task Definition

```bash
# Get your account ID and RDS/DocumentDB endpoints
ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
RDS_ENDPOINT=$(aws rds describe-db-instances --db-instance-identifier smart-home-care-db --query 'DBInstances[0].Endpoint.Address' --output text)
DOCDB_ENDPOINT=$(aws docdb describe-db-clusters --db-cluster-identifier smart-home-care-mongo --query 'DBClusters[0].Endpoint' --output text)

# Create task definition
cat > task-definition.json << EOF
{
  "family": "smart-home-care-api",
  "networkMode": "awsvpc",
  "requiresCompatibilities": ["FARGATE"],
  "cpu": "512",
  "memory": "1024",
  "executionRoleArn": "arn:aws:iam::${ACCOUNT_ID}:role/ecsTaskExecutionRole",
  "containerDefinitions": [
    {
      "name": "api",
      "image": "${ACCOUNT_ID}.dkr.ecr.us-east-1.amazonaws.com/smart-home-care-api:latest",
      "portMappings": [
        {
          "containerPort": 3000,
          "protocol": "tcp"
        }
      ],
      "environment": [
        {
          "name": "DB_URL",
          "value": "postgresql://admin:YourSecurePassword123!@${RDS_ENDPOINT}:5432/alert_monitoring"
        },
        {
          "name": "MONGO_URL",
          "value": "mongodb://admin:YourSecurePassword123!@${DOCDB_ENDPOINT}:27017/alert_monitoring?tls=true&replicaSet=rs0&readPreference=secondaryPreferred&retryWrites=false"
        },
        {
          "name": "JWT_SECRET",
          "value": "change-this-to-secure-random-string"
        },
        {
          "name": "NODE_ENV",
          "value": "production"
        },
        {
          "name": "PORT",
          "value": "3000"
        }
      ],
      "logConfiguration": {
        "logDriver": "awslogs",
        "options": {
          "awslogs-group": "/ecs/smart-home-care-api",
          "awslogs-region": "us-east-1",
          "awslogs-stream-prefix": "ecs"
        }
      }
    }
  ]
}
EOF

# Register task definition
aws ecs register-task-definition --cli-input-json file://task-definition.json
```

---

## Step 9: Create Application Load Balancer

```bash
# Create ALB
aws elbv2 create-load-balancer \
  --name smart-home-care-alb \
  --subnets subnet-xxxxxxxx subnet-yyyyyyyy \
  --security-groups sg-xxxxxxxxx \
  --scheme internet-facing \
  --type application

# Get ALB ARN
ALB_ARN=$(aws elbv2 describe-load-balancers \
  --names smart-home-care-alb \
  --query 'LoadBalancers[0].LoadBalancerArn' \
  --output text)

# Create target group
aws elbv2 create-target-group \
  --name smart-home-care-tg \
  --protocol HTTP \
  --port 3000 \
  --vpc-id vpc-xxxxxxxxx \
  --target-type ip \
  --health-check-path /health \
  --health-check-interval-seconds 30

# Get target group ARN
TG_ARN=$(aws elbv2 describe-target-groups \
  --names smart-home-care-tg \
  --query 'TargetGroups[0].TargetGroupArn' \
  --output text)

# Create listener
aws elbv2 create-listener \
  --load-balancer-arn $ALB_ARN \
  --protocol HTTP \
  --port 80 \
  --default-actions Type=forward,TargetGroupArn=$TG_ARN
```

---

## Step 10: Create ECS Service

```bash
# Create service
aws ecs create-service \
  --cluster smart-home-care \
  --service-name smart-home-care-api \
  --task-definition smart-home-care-api \
  --desired-count 2 \
  --launch-type FARGATE \
  --network-configuration "awsvpcConfiguration={subnets=[subnet-xxxxxxxx,subnet-yyyyyyyy],securityGroups=[sg-xxxxxxxxx],assignPublicIp=ENABLED}" \
  --load-balancers "targetGroupArn=$TG_ARN,containerName=api,containerPort=3000"

# Wait for service to be stable
aws ecs wait services-stable \
  --cluster smart-home-care \
  --services smart-home-care-api
```

---

## Step 11: Get Your Application URLs

```bash
# Get ALB DNS name
ALB_DNS=$(aws elbv2 describe-load-balancers \
  --names smart-home-care-alb \
  --query 'LoadBalancers[0].DNSName' \
  --output text)

echo "Backend API: http://$ALB_DNS"
echo "Frontend: http://smart-home-care-frontend.s3-website-us-east-1.amazonaws.com"
```

---

## Step 12: Update Frontend API URL

```bash
# Update frontend to use ALB URL
cd vite-project

# Create .env file
cat > .env << EOF
VITE_API_BASE=http://$ALB_DNS
EOF

# Rebuild and redeploy
npm run build
aws s3 sync dist/ s3://smart-home-care-frontend --delete
```

---

## Step 13: Set Up CloudFront (Optional - for HTTPS)

```bash
# Create CloudFront distribution
aws cloudfront create-distribution \
  --origin-domain-name smart-home-care-frontend.s3.amazonaws.com \
  --default-root-object index.html

# Get CloudFront domain
aws cloudfront list-distributions \
  --query 'DistributionList.Items[0].DomainName' \
  --output text
```

---

## Step 14: Initialize Database Schema

```bash
# Connect to RDS and run schema
psql -h $RDS_ENDPOINT -U admin -d postgres << 'EOF'
CREATE DATABASE alert_monitoring;
\c alert_monitoring

-- Run your schema from vite-project/server/db/schema.sql
EOF
```

---

## Step 15: Test Deployment

```bash
# Test backend health
curl http://$ALB_DNS/health

# Test frontend
curl http://smart-home-care-frontend.s3-website-us-east-1.amazonaws.com

# Test login
curl -X POST http://$ALB_DNS/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@example.com","password":"admin123"}'
```

---

## Cleanup (When Done Testing)

```bash
# Delete ECS service
aws ecs delete-service --cluster smart-home-care --service smart-home-care-api --force

# Delete ECS cluster
aws ecs delete-cluster --cluster smart-home-care

# Delete ALB
aws elbv2 delete-load-balancer --load-balancer-arn $ALB_ARN

# Delete target group
aws elbv2 delete-target-group --target-group-arn $TG_ARN

# Delete RDS instance
aws rds delete-db-instance --db-instance-identifier smart-home-care-db --skip-final-snapshot

# Delete DocumentDB cluster
aws docdb delete-db-cluster --db-cluster-identifier smart-home-care-mongo --skip-final-snapshot

# Empty and delete S3 bucket
aws s3 rm s3://smart-home-care-frontend --recursive
aws s3 rb s3://smart-home-care-frontend

# Delete ECR repository
aws ecr delete-repository --repository-name smart-home-care-api --force
```

---

## Cost Estimate

- **RDS PostgreSQL (db.t3.micro)**: ~$15/month
- **DocumentDB (db.t3.medium)**: ~$60/month
- **ECS Fargate (2 tasks)**: ~$30/month
- **ALB**: ~$20/month
- **S3 + CloudFront**: ~$5/month
- **Data Transfer**: ~$10/month

**Total: ~$140/month**

---

## Troubleshooting

### Can't connect to RDS/DocumentDB
- Check security group allows inbound from ECS tasks
- Verify VPC and subnet configuration
- Check credentials in task definition

### ECS tasks failing
- Check CloudWatch logs: `/ecs/smart-home-care-api`
- Verify environment variables in task definition
- Check Docker image is pushed to ECR

### Frontend can't reach backend
- Update CORS settings in backend
- Verify ALB security group allows port 80
- Check ALB health checks are passing

---

## Next Steps

1. Set up Route 53 for custom domain
2. Add SSL certificate with ACM
3. Configure CloudFront for HTTPS
4. Set up auto-scaling policies
5. Configure CloudWatch alarms
6. Set up automated backups
7. Implement CI/CD with GitHub Actions

