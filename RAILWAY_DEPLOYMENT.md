# 🚂 Railway Deployment Guide for CloneMentorPro

## Quick Setup Instructions

### Step 1: Access Railway Dashboard
1. Go to [railway.app/dashboard](https://railway.app/dashboard)
2. Login with your GitHub account (same credentials as GitHub)
3. Click "New Project" → "Deploy from GitHub repo"

### Step 2: Connect Repository
1. Select repository: `kaseydoesmarketing/web`
2. Set **Root Directory**: `CloneMentorPro`
3. Railway will auto-detect `railway.json` and `nixpacks.toml`

### Step 3: Verify Configuration
Railway will automatically configure:
- **Build Command**: `npm install`
- **Start Command**: `npm run server`
- **Builder**: NIXPACKS (for Puppeteer support)

### Step 4: Environment Variables
These are automatically set via `railway.json`:
```
NODE_ENV=production
PORT=${{RAILWAY_PORT}}
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
PUPPETEER_EXECUTABLE_PATH=/nix/store/*/bin/chromium
```

### Step 5: Deploy and Test
1. Click "Deploy" 
2. Wait for build completion (~3-5 minutes)
3. Get your Railway URL: `https://clonementorpro-production-[hash].up.railway.app`
4. Test health endpoint: `[your-url]/api/health`

## Configuration Files Already Set Up

### ✅ railway.json
```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "builder": "NIXPACKS",
    "buildCommand": "npm install"
  },
  "deploy": {
    "startCommand": "npm run server",
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10
  }
}
```

### ✅ nixpacks.toml
```toml
[phases.setup]
nixPkgs = ["chromium", "glib", "nss", "nspr", "atk", ...]

[phases.install]
cmds = ["npm install", "npm install puppeteer"]

[start]
cmd = "npm run server"

[variables]
PUPPETEER_SKIP_CHROMIUM_DOWNLOAD = "true"
PUPPETEER_EXECUTABLE_PATH = "/nix/store/*/bin/chromium"
```

## Key Features Enabled

### 🌐 Puppeteer Support
- Chromium browser with all system dependencies
- Template cleaning fix: 25KB → 150KB threshold
- Headless Chrome for web scraping

### 🔧 Production Ready
- Auto-restart on failure (max 10 retries)
- Health check endpoint: `/api/health`
- CORS configured for Vercel frontend
- Production environment variables

### 💰 Cost Efficient
- $5 monthly free credit
- Pay-per-use after free tier
- No cold starts (persistent servers)

## Next Steps After Deployment

1. **Get Railway URL** from dashboard
2. **Update Vercel Configuration**:
   ```json
   {
     "rewrites": [
       {
         "source": "/api/(.*)",
         "destination": "https://[your-railway-url]/api/$1"
       }
     ]
   }
   ```
3. **Test Full Stack**:
   - Frontend: `https://clonementorpro.vercel.app`
   - Backend: `https://[your-railway-url]`
   - API Test: Clone a website end-to-end

## Troubleshooting

### Build Issues
- Check logs in Railway dashboard
- Verify `nixpacks.toml` is being used
- Ensure `npm run server` script exists

### Runtime Issues
- Check environment variables are set
- Test `/api/health` endpoint
- Review Puppeteer dependencies in logs

### Performance Issues
- Monitor memory usage (Railway provides metrics)
- Check template cleaning logs for large websites
- Verify timeout settings (increased from 25KB to 150KB)

## Emergency Fixes Already Applied

✅ **Template Cleaning Bug Fixed**: 
- Threshold increased from 25KB to 150KB
- Complex websites now preserve content quality
- Located in: `server/core/visual-elementor-converter.js:67-76`

✅ **CORS Configuration**:
- Headers set for Vercel frontend
- All HTTP methods supported
- Cross-origin requests enabled

✅ **Health Check**:
- Endpoint: `/api/health`
- Returns JSON status
- Used for Railway deployment verification

Your CloneMentorPro backend is ready for Railway deployment! 🎉