#!/bin/bash

# Quick Deployment Script for Smart Home Care System
# This script helps you deploy to various cloud platforms

set -e

echo "🚀 Smart Home Care - Quick Deploy"
echo "=================================="
echo ""

# Check if required tools are installed
check_tool() {
    if ! command -v $1 &> /dev/null; then
        echo "❌ $1 is not installed. Please install it first."
        return 1
    else
        echo "✅ $1 is installed"
        return 0
    fi
}

# Menu
echo "Choose deployment platform:"
echo "1) Vercel + Railway (Easiest - 5 minutes)"
echo "2) Docker Compose (Local testing)"
echo "3) AWS (Production - requires AWS CLI)"
echo "4) DigitalOcean (Balanced)"
echo ""
read -p "Enter choice [1-4]: " choice

case $choice in
    1)
        echo ""
        echo "📦 Deploying to Vercel + Railway..."
        echo ""
        
        # Check tools
        check_tool "vercel" || npm install -g vercel
        check_tool "railway" || npm install -g @railway/cli
        
        # Deploy frontend to Vercel
        echo ""
        echo "🎨 Deploying frontend to Vercel..."
        cd vite-project
        vercel --prod
        cd ..
        
        # Deploy backend to Railway
        echo ""
        echo "⚙️  Deploying backend to Railway..."
        cd vite-project/server
        railway login
        railway init
        railway up
        cd ../..
        
        echo ""
        echo "✅ Deployment complete!"
        echo "📝 Next steps:"
        echo "   1. Add PostgreSQL plugin in Railway dashboard"
        echo "   2. Add MongoDB plugin in Railway dashboard"
        echo "   3. Update frontend API_BASE to Railway URL"
        ;;
        
    2)
        echo ""
        echo "🐳 Starting with Docker Compose..."
        echo ""
        
        check_tool "docker" || { echo "Please install Docker first"; exit 1; }
        
        # Build and start containers
        docker-compose up -d --build
        
        echo ""
        echo "✅ Services started!"
        echo "📝 Access points:"
        echo "   Frontend: http://localhost:8080 (serve vite-project manually)"
        echo "   Backend API: http://localhost:3000"
        echo "   PostgreSQL: localhost:5432"
        echo "   MongoDB: localhost:27017"
        echo ""
        echo "📊 View logs: docker-compose logs -f"
        echo "🛑 Stop services: docker-compose down"
        ;;
        
    3)
        echo ""
        echo "☁️  AWS Deployment..."
        echo ""
        
        check_tool "aws" || { echo "Please install AWS CLI first"; exit 1; }
        
        echo "This requires:"
        echo "  - AWS account configured (aws configure)"
        echo "  - S3 bucket created"
        echo "  - ECR repository created"
        echo "  - ECS cluster created"
        echo "  - RDS PostgreSQL instance"
        echo "  - DocumentDB cluster"
        echo ""
        read -p "Have you set these up? (y/n): " aws_ready
        
        if [ "$aws_ready" = "y" ]; then
            # Build frontend
            echo "Building frontend..."
            cd vite-project
            npm install
            npm run build
            
            # Deploy to S3
            read -p "Enter S3 bucket name: " bucket_name
            aws s3 sync dist/ s3://$bucket_name --acl public-read
            
            echo "✅ Frontend deployed to S3"
            echo "📝 Setup CloudFront distribution manually in AWS Console"
            
            cd ..
        else
            echo "Please set up AWS resources first. See DEPLOYMENT.md for details."
        fi
        ;;
        
    4)
        echo ""
        echo "🌊 DigitalOcean Deployment..."
        echo ""
        
        check_tool "doctl" || { echo "Please install doctl first: https://docs.digitalocean.com/reference/doctl/"; exit 1; }
        
        echo "Creating app.yaml configuration..."
        echo "Please push your code to GitHub first, then:"
        echo "  1. Go to DigitalOcean App Platform"
        echo "  2. Connect your GitHub repository"
        echo "  3. Use the app.yaml configuration from DEPLOYMENT.md"
        echo ""
        echo "Or use: doctl apps create --spec app.yaml"
        ;;
        
    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

echo ""
echo "🎉 Done! Check DEPLOYMENT.md for more details."
