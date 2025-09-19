#!/bin/bash

# Railway Deployment Setup for CloneMentorPro
# Run this script to complete the Railway deployment

echo "🚂 Railway Deployment Setup for CloneMentorPro"
echo "=============================================="
echo ""

# Check if Railway CLI is installed
if ! command -v railway &> /dev/null; then
    echo "❌ Railway CLI not found. Installing..."
    npm install -g @railway/cli
fi

echo "📋 Deployment Configuration Summary:"
echo "• API Key: 672bb71f-8edc-4296-b0f0-6760ff59b86d"
echo "• Repository: https://github.com/kaseydoesmarketing/web"
echo "• Root Directory: CloneMentorPro"
echo "• Build Command: npm install"
echo "• Start Command: npm run server"
echo "• Port: Dynamic (Railway assigns)"
echo ""

echo "🔧 Manual Setup Required:"
echo ""
echo "1. Go to https://railway.app/dashboard"
echo "2. Click 'New Project' → 'Deploy from GitHub repo'"
echo "3. Connect your GitHub account if not connected"
echo "4. Select repository: kaseydoesmarketing/web"
echo "5. Set Root Directory: CloneMentorPro"
echo "6. Railway will auto-detect nixpacks.toml and railway.json"
echo ""

echo "🌐 Environment Variables (Railway will auto-configure):"
echo "• NODE_ENV=production"
echo "• PORT=\${{RAILWAY_PORT}}"
echo "• PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true"  
echo "• PUPPETEER_EXECUTABLE_PATH=/nix/store/*/bin/chromium"
echo ""

echo "📦 Puppeteer Dependencies (from nixpacks.toml):"
echo "• Chromium browser"
echo "• Required system libraries (glib, nss, atk, etc.)"
echo ""

echo "🎯 Expected Deployment URL:"
echo "• Format: https://clonementorpro-production-[hash].up.railway.app"
echo "• Health check: /api/health"
echo ""

echo "✅ Files Already Committed:"
echo "• railway.json - Railway configuration"
echo "• nixpacks.toml - Puppeteer dependencies"
echo "• render.yaml - Updated for proper deployment"
echo ""

echo "🔍 Next Steps After Deployment:"
echo "1. Test the API: curl https://[your-railway-url]/api/health"
echo "2. Update Vercel configuration with new Railway URL"
echo "3. Test full website cloning functionality"
echo ""

echo "🚨 Important Notes:"
echo "• Railway provides \$5 free credit monthly"
echo "• Puppeteer requires persistent servers (not serverless)"
echo "• Template cleaning fix is already deployed (25KB → 150KB threshold)"
echo ""

read -p "Press Enter to continue with manual Railway dashboard setup..."

echo ""
echo "🎉 Ready for Railway deployment!"
echo "Visit: https://railway.app/dashboard"
echo "Use your API key: 672bb71f-8edc-4296-b0f0-6760ff59b86d"
echo ""