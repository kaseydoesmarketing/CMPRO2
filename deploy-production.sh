#!/bin/bash

# CMPRO2 Production Deployment Script
# This script deploys the backend to Railway and frontend to Vercel

echo "🚀 CMPRO2 Production Deployment Script"
echo "======================================="

# Color codes for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check prerequisites
echo ""
echo "📋 Checking prerequisites..."

# Check if Railway CLI is installed
if command -v railway &> /dev/null; then
    print_status "Railway CLI is installed"
else
    print_error "Railway CLI is not installed"
    echo "Install it with: npm install -g @railway/cli"
    exit 1
fi

# Check if Vercel CLI is installed
if command -v vercel &> /dev/null; then
    print_status "Vercel CLI is installed"
else
    print_error "Vercel CLI is not installed"
    echo "Install it with: npm install -g vercel"
    exit 1
fi

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    print_error "Must be run from CMPRO2 root directory"
    exit 1
fi

# Deploy Backend to Railway
echo ""
echo "🚂 Deploying Backend to Railway..."
echo "===================================="

print_warning "Please ensure you're logged into Railway (railway login)"
print_warning "And linked to your project (railway link)"

echo ""
read -p "Deploy backend to Railway? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Starting Railway deployment..."

    # Deploy to Railway
    railway up --detach

    if [ $? -eq 0 ]; then
        print_status "Backend deployed to Railway successfully!"
        echo ""
        echo "Get your Railway URL with: railway domain"

        # Try to get the domain
        RAILWAY_URL=$(railway domain 2>/dev/null | grep -oE 'https://[^ ]+' | head -1)
        if [ ! -z "$RAILWAY_URL" ]; then
            echo "Backend URL: $RAILWAY_URL"
        fi
    else
        print_error "Railway deployment failed"
        print_warning "Please check your Railway login and project link"
        echo "Run: railway login"
        echo "Then: railway link"
    fi
else
    print_warning "Skipping Railway deployment"
fi

# Deploy Frontend to Vercel
echo ""
echo "▲ Deploying Frontend to Vercel..."
echo "===================================="

print_warning "Please ensure you're logged into Vercel (vercel login)"

echo ""
read -p "Deploy frontend to Vercel? (y/n): " -n 1 -r
echo ""
if [[ $REPLY =~ ^[Yy]$ ]]; then
    echo "Building production frontend..."
    npm run build

    if [ $? -eq 0 ]; then
        print_status "Frontend built successfully"

        echo "Starting Vercel deployment..."
        vercel --prod

        if [ $? -eq 0 ]; then
            print_status "Frontend deployed to Vercel successfully!"
        else
            print_error "Vercel deployment failed"
            print_warning "Please check your Vercel login"
            echo "Run: vercel login"
        fi
    else
        print_error "Frontend build failed"
    fi
else
    print_warning "Skipping Vercel deployment"
fi

# Summary
echo ""
echo "📊 Deployment Summary"
echo "====================="

# Check deployment status
echo ""
echo "Next Steps:"
echo "1. Update environment variables in Railway dashboard"
echo "2. Update environment variables in Vercel dashboard"
echo "3. Update Vercel rewrite rules to point to Railway backend URL"
echo "4. Test the production deployment"
echo ""
echo "Environment Variables needed:"
echo ""
echo "Railway (Backend):"
echo "  - NODE_ENV=production"
echo "  - STRIPE_SECRET_KEY=your_stripe_key"
echo "  - STRIPE_WEBHOOK_SECRET=your_webhook_secret"
echo ""
echo "Vercel (Frontend):"
echo "  - VITE_API_URL=your_railway_backend_url"
echo ""

print_status "Deployment script completed!"