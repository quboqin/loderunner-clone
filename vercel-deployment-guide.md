# Vercel Deployment Guide - Asset Loading Issue Resolution

## Problem Summary
The Lode Runner game was failing to load JSON sprite atlas files on Vercel production, with the error:
```
Uncaught SyntaxError: Unexpected token '<', "<!DOCTYPE "... is not valid JSON
```

This occurred because Vercel was serving HTML instead of JSON for these files due to configuration issues.

## Root Cause Analysis
1. **Vercel Rewrite Rule Issue**: The catch-all rewrite `"source": "/(.*)", "destination": "/index.html"` was intercepting all requests, including JSON files
2. **Asset Path Problem**: Relative paths (`./assets/`) weren't resolving correctly in production
3. **MIME Type Issues**: JSON files weren't being served with proper `application/json` content type

## Fixes Applied

### 1. Updated Vercel Configuration (`vercel.json`)
```json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "devCommand": "npm run dev", 
  "installCommand": "npm install",
  "framework": "vite",
  "headers": [
    {
      "source": "/assets/(.*)",
      "headers": [
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        },
        {
          "key": "Cross-Origin-Resource-Policy",
          "value": "cross-origin"
        }
      ]
    },
    {
      "source": "/assets/**/*.json",
      "headers": [
        {
          "key": "Content-Type",
          "value": "application/json"
        },
        {
          "key": "Cache-Control",
          "value": "public, max-age=31536000, immutable"
        }
      ]
    }
  ],
  "rewrites": [
    {
      "source": "/((?!assets/).*)",
      "destination": "/index.html"
    }
  ]
}
```

**Key Changes:**
- Changed rewrite rule to exclude `/assets/` paths: `"source": "/((?!assets/).*)"` 
- Added explicit JSON MIME type header for all JSON files
- Preserved asset caching configuration

### 2. Fixed Asset Paths in Code
Updated all asset paths from relative (`./assets/`) to absolute (`/assets/`) paths:

**AssetManager.ts** - Updated all sprite atlas, image, and audio paths:
```typescript
// Before: './assets/sprites/runner.png'
// After:  '/assets/sprites/runner.png'
```

**PreloadScene.ts** - Updated level data path:
```typescript
// Before: './assets/levels/classic.json'
// After:  '/assets/levels/classic.json'
```

### 3. Optimized Vite Configuration (`vite.config.ts`)
```typescript
export default defineConfig({
  base: '/',  // Changed from './' to '/'
  // ... other config
  build: {
    // ... other build config
    rollupOptions: {
      output: {
        manualChunks: {
          phaser: ['phaser']
        },
        assetFileNames: (assetInfo) => {
          // Preserve directory structure for JSON files
          if (assetInfo.name && assetInfo.name.endsWith('.json')) {
            return 'assets/[name][extname]';
          }
          return 'assets/[name]-[hash][extname]';
        }
      }
    }
  }
});
```

## Deployment Instructions

### Prerequisites
- Install Vercel CLI globally: `npm install -g vercel`
- Have a Vercel account

### Step-by-Step Instructions

**1. Build the project locally to test:**
```bash
npm run build
```

**2. Test locally (optional):**
```bash
npm run preview
```

**3. Deploy to Vercel:**
```bash
vercel login
vercel
```

**4. For production deployment:**
```bash
vercel --prod
```

## Asset Structure Verification
The build process should create this structure in `dist/`:
```
dist/
├── assets/
│   ├── sprites/
│   │   ├── runner.json ✓
│   │   ├── guard.json ✓
│   │   ├── tiles.json ✓
│   │   └── hole.json ✓
│   ├── anims/
│   │   ├── runner.json ✓
│   │   ├── guard.json ✓
│   │   └── hole.json ✓
│   └── levels/
│       └── classic.json ✓
└── index.html
```

## Verification Steps Post-Deployment
1. Open browser developer tools
2. Go to Network tab
3. Load the game
4. Verify all JSON files return with:
   - Status: `200 OK`
   - Content-Type: `application/json`
   - Valid JSON content (not HTML)

## Performance Optimizations Included
- **Caching Headers**: 1-year cache for immutable assets
- **CORS Policy**: Cross-origin resource sharing enabled
- **Asset Chunking**: Phaser.js separated into its own chunk
- **Directory Preservation**: JSON files maintain original paths

## Expected Results
- ✅ All sprite atlas JSON files load correctly
- ✅ Game initializes without console errors  
- ✅ Phaser.js can process sprite atlases properly
- ✅ Smooth gameplay experience on Vercel platform
- ✅ Proper asset caching for performance

## Key Configuration Files Updated
- `/Users/qinqubo/magic/vibe-coding/loderunner-clone/vercel.json`
- `/Users/qinqubo/magic/vibe-coding/loderunner-clone/vite.config.ts`
- `/Users/qinqubo/magic/vibe-coding/loderunner-clone/src/managers/AssetManager.ts`
- `/Users/qinqubo/magic/vibe-coding/loderunner-clone/src/scenes/PreloadScene.ts`