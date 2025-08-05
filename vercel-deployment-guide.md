# Vercel Branch Deployment Plan

## Method: Direct CLI Deployment

### Prerequisites
- Install Vercel CLI globally: `npm install -g vercel`
- Ensure you're on the `vercel-deploy` branch
- Have a Vercel account

### Step-by-Step Instructions

**1. Install Vercel CLI (if not already installed):**
```bash
npm install -g vercel
```

**2. Navigate to your project directory:**
```bash
cd /Users/qinqubo/magic/vibe-coding/loderunner-clone
```

**3. Ensure you're on the correct branch:**
```bash
git checkout vercel-deploy
```

**4. Login to Vercel:**
```bash
vercel login
```

**5. Deploy the project:**
```bash
vercel
```
- This will create a preview deployment from your current branch
- Follow interactive prompts to configure the project
- Accept defaults or customize as needed

**6. For production deployment (optional):**
```bash
vercel --prod
```

### What Happens
- Vercel CLI will detect your project configuration from `vercel.json`
- It will use your Vite build settings
- All assets in `public/` will be properly served
- You'll get a deployment URL immediately

### Key Benefits
- ✅ Works with any branch (including `vercel-deploy`)
- ✅ Command-line based as requested
- ✅ Immediate deployment without Git integration setup
- ✅ Uses your existing `vercel.json` configuration
- ✅ Perfect for testing branch-specific changes

### Configuration Notes
- The project uses Vite as the build framework
- Assets are served from `public/assets/` directory
- `vercel.json` includes proper caching headers for game assets
- Build output goes to `dist/` directory

### Troubleshooting
If you encounter "invalid source pattern" errors, ensure your `vercel.json` uses valid Vercel route patterns (not full regex syntax).