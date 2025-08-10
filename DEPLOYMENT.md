# Deployment Guide

This project supports deployment to both Vercel and Netlify platforms.

## Vercel Deployment

### Configuration Files
- `vercel.json` - Vercel-specific configuration for SPA routing and headers

### Deployment Steps
1. Install Vercel CLI: `npm i -g vercel`
2. Deploy: `vercel`
3. Or connect your GitHub repo to Vercel dashboard for automatic deployments

### Current Configuration
- Build command: `npm run build`
- Output directory: `dist`
- SPA routing with asset exclusion using negative lookahead

## Netlify Deployment

### Configuration Files
- `netlify.toml` - Main Netlify configuration
- `public/_redirects` - Redirect rules for SPA routing

### Deployment Steps

#### Method 1: Netlify CLI
1. Install Netlify CLI: `npm i -g netlify-cli`
2. Build: `npm run build`
3. Deploy: `netlify deploy --prod --dir=dist`

#### Method 2: Git Integration
1. Connect your GitHub repo to Netlify
2. Netlify will automatically use the `netlify.toml` configuration
3. Build command: `npm run build`
4. Publish directory: `dist`

### Netlify Features
- Automatic static asset serving (no rewrite rules needed for assets)
- SPA fallback routing via `_redirects` and `netlify.toml`
- Headers for asset caching and CORS
- Environment variables support

## Asset Handling

Both platforms handle the game assets (JSON, PNG, audio files) located in:
- `public/assets/sprites/` - Game sprite atlases and JSON
- `public/assets/images/` - UI images
- `public/assets/audio/` - Sound effects and music
- `public/assets/anims/` - Animation definitions
- `public/assets/levels/` - Level data

## Key Differences

| Feature | Vercel | Netlify |
|---------|--------|---------|
| Static Assets | Requires explicit routing rules | Automatic |
| SPA Routing | Complex rewrite patterns needed | Simple `_redirects` file |
| Configuration | `vercel.json` | `netlify.toml` + `_redirects` |
| Asset Serving | Can be problematic with catch-all routes | Natural static file serving |

## Troubleshooting

### Common Issues
- **JSON assets served as HTML**: Usually a routing configuration issue where SPA fallback catches asset requests
- **404 on refresh**: Need proper SPA redirect rules
- **CORS issues**: Check Cross-Origin headers in configuration files

### Solutions
- **Netlify**: Generally more straightforward for static assets + SPA
- **Vercel**: Requires careful rewrite rule ordering to avoid asset conflicts