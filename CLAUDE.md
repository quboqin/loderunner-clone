# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a web-based Lode Runner clone built using Phaser.js game engine. The project aims to recreate the classic Lode Runner gameplay in a modern web browser environment.

**Key References:**
- Game engine: [Phaser.js](https://docs.phaser.io/phaser/getting-started/what-is-phaser)
- Assets and level data reference: https://github.com/quboqin/Lode-Runner-Roku

## Development Setup

Since this project uses Phaser.js for web development, typical commands will include:

```bash
# Install dependencies
npm install

# Start development server  
npm run dev

# Build for production
npm run build

# Run tests
npm test
```

## Architecture Guidelines

### Current Architecture Status (2025)
- **Foundation**: Solid base with Player/Guard entities extending BaseEntity
- **Input System**: Centralized through InputManager
- **Main Issue**: GameScene still concentrates multiple responsibilities (>600 lines)
- **Target**: Modular system architecture following Phaser 3 best practices

### Game Structure
- **Phaser.js Framework**: Modern HTML5 game framework for 2D games
- **Level System**: Reference the Roku implementation for level data structures and design patterns
- **Asset Management**: Sprites, animations, and audio from the referenced repository
- **Web Browser Target**: Designed to run in modern web browsers

### Key Components
- **Implemented**: Player entity, Guard entity with AI, InputManager, SoundManager, AssetManager
- **Scene Organization**: Boot → Preload → Menu → Game → GameOver
- **Entity Architecture**: BaseEntity parent class with Player and Guard extensions
- **Systems to Extract**:
  - LevelSystem: Tilemap parsing, group creation, tile collision
  - HoleSystem: Dig/fill/restore timers and lifecycle
  - ExitSystem: Exit ladder reveal, marker lifecycle, completion detection
  - DebugSystem: Overlays and debug text rendering

### Phaser 3 Best Practices to Follow
- Keep scenes under 500-600 lines
- Entity encapsulation (animations within entities, not scenes)
- System architecture with single responsibility principle
- Event bus for cross-system communication
- Object pooling for transient sprites (holes, score popups)
- Environment-aware logging through Logger utility

## Development Notes

- Follow Phaser.js best practices and patterns
- Implement responsive design for different screen sizes
- Ensure cross-browser compatibility
- Use modern JavaScript/TypeScript features as appropriate
- Structure code for maintainability and extensibility

### Code Quality Standards
- **Logging**: Use Logger utility instead of console.log in production code
- **Magic Numbers**: Centralize all thresholds and constants in GAME_CONFIG
- **Testing**: Run tests with `npm test` before committing changes
- **Linting**: Check code quality with appropriate linters
- **Type Safety**: Leverage TypeScript for type checking

### Refactoring Priorities (Phase-by-Phase)
1. **PHASE 1 - Immediate**: Console log cleanup, Exit system hardening
2. **PHASE 2 - High Priority**: Scene decomposition (Hole/Level/Debug systems)
3. **PHASE 3 - Medium Priority**: Event bus, observability via registry
4. **PHASE 4 - Low Priority**: Performance optimization, object pooling

## Asset Integration

When integrating assets from the reference repository:
- Maintain proper attribution
- Ensure sprite sheets are optimized for web delivery
- Implement efficient asset loading strategies
- Consider audio format compatibility across browsers

## Project Management

- **Progress Tracking**: Use `PROJECT_PROGRESS.md` for development phase tracking and task management
- **Sub-Agents**: Project Manager Agent and UX/Animation Specialist available in `.claude/agents/`
- **Development Phases**: 9-phase structure from foundation through deployment

## Deployment Notes

### Netlify Deployment
- **Configuration**: `netlify.toml` + `public/_redirects`
- **Build Command**: `npm run build`
- **Output Directory**: `dist`
- **Deploy via CLI**: 
  ```bash
  npm i -g netlify-cli
  npm run build
  netlify deploy --prod --dir=dist
  ```
- **Git Integration**: Connect GitHub repo to Netlify for automatic deployments
- **Advantage**: More straightforward static asset handling, automatic builds on push

### Asset Locations
Game assets are served from `public/` directory:
- `/assets/sprites/` - Game sprite atlases and JSON
- `/assets/images/` - UI images
- `/assets/audio/` - Sound effects and music
- `/assets/anims/` - Animation definitions
- `/assets/levels/` - Level data

### Deployment Troubleshooting

#### General Issues  
- **JSON served as HTML**: Check SPA routing rules aren't catching asset requests
- **404 on refresh**: Ensure proper SPA redirect rules are configured
- **CORS issues**: Verify Cross-Origin headers in platform configuration
- **Build failures**: Check Node.js version compatibility (18.x or 20.x recommended)

#### Debugging Commands
```bash
# Test asset loading directly
curl -I https://your-app.netlify.app/assets/sprites/runner.png
curl -I https://your-app.netlify.app/assets/audio/dig.wav

# Check build output locally
ls -la dist/assets/
find dist/assets/ -name "*.png" -o -name "*.wav" -o -name "*.json"
```

## Claude Interaction Guidelines

- Every time you finish modifying a feature, confirm with me first and don't submit the code immediately.