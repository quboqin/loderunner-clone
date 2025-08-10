# 🎮 Lode Runner Clone

A fully functional web-based clone of the classic Lode Runner game, built entirely with AI assistance using Claude Code. This project demonstrates the power of AI-driven development - **zero lines of code were written manually**.

## 🚀 Live Demo

**Play Now:** https://scintillating-pastelito-50e97c.netlify.app/

**Repository:** https://github.com/quboqin/loderunner-clone

## ✨ Features

### 🎯 Core Gameplay
- **Classic Lode Runner mechanics** - Authentic IBM-style gameplay recreation
- **Complete collision system** - Precise physics and boundary detection
- **Hole digging mechanics** - Strategic Z/X controls with 3-second regeneration
- **Gold collection system** - Collision-based detection with visual feedback
- **Level progression** - Exit ladder unlocks when all gold is collected
- **Multiple game levels** - Progressive difficulty with varied layouts

### 🤖 Advanced Guard AI
- **11 different animation states** - Idle, running, climbing, falling, in_hole, escaping, etc.
- **Intelligent pathfinding** - Guards actively seek ladders to reach different levels
- **Smart vertical navigation** - AI navigates multi-level environments
- **Classic hole escape mechanics** - 2.5s escape window vs 3s hole refill timing
- **Guard collision prevention** - Intelligent bounce separation system
- **Head-stepping mechanics** - Safe player-over-guard collision detection

### 🎨 Visual & Audio
- **Authentic IBM assets** - Classic sprites and animations from original game
- **Smooth 30 FPS animations** - Optimized hole digging and character movement
- **Complete sound integration** - Audio feedback for all game actions
- **Responsive UI** - Mobile-friendly interface with proper scaling
- **Professional visual hierarchy** - Proper depth layering and rendering

### 🎮 Controls
- **Arrow Keys** - Move left/right, climb up/down ladders and ropes
- **Z Key** - Dig hole to the left
- **X Key** - Dig hole to the right  
- **ESC Key** - Return to main menu (pause functionality)

## 🛠️ Technology Stack

- **Game Engine:** Phaser.js 3.85+
- **Language:** TypeScript
- **Build System:** Vite 6.0+
- **Deployment:** Vercel + Netlify (dual-platform support)
- **Development:** Claude Code (AI-assisted development)

## 🚀 Quick Start

### Prerequisites
- Node.js 18.0.0 or higher
- npm or yarn package manager

### Local Development
```bash
# Clone the repository
git clone https://github.com/quboqin/loderunner-clone.git
cd loderunner-clone

# Install dependencies
npm install

# Start development server
npm run dev

# Open http://localhost:3000 in your browser
```

### Building for Production
```bash
# Create production build
npm run build

# Preview production build locally
npm run preview
```

## 🌐 Deployment

This project supports deployment to both **Vercel** and **Netlify**:

### Netlify (Recommended)
```bash
# Install Netlify CLI
npm i -g netlify-cli

# Build and deploy
npm run build
netlify deploy --prod --dir=dist
```

### Vercel
```bash
# Install Vercel CLI  
npm i -g vercel

# Deploy
vercel
```

**Note:** Netlify is recommended due to better static asset serving for game resources.

## 📁 Project Structure

```
loderunner-clone/
├── public/
│   └── assets/          # Game assets (sprites, audio, levels)
│       ├── sprites/     # Character and tile atlases
│       ├── audio/       # Sound effects and music
│       ├── images/      # UI graphics
│       ├── anims/       # Animation definitions
│       └── levels/      # Level data files
├── src/
│   ├── managers/        # Core game systems
│   │   ├── AssetManager.ts
│   │   ├── InputManager.ts
│   │   └── SoundManager.ts
│   ├── scenes/          # Phaser game scenes
│   │   ├── MenuScene.ts
│   │   ├── GameScene.ts
│   │   ├── GameOverScene.ts
│   │   └── PreloadScene.ts
│   ├── config/          # Game configuration
│   └── types/           # TypeScript definitions
├── vercel.json          # Vercel deployment config
├── netlify.toml         # Netlify deployment config
└── DEPLOYMENT.md        # Detailed deployment guide
```

## 🎮 Game Mechanics

### Player Actions
- **Movement:** Full physics with gravity and collision detection
- **Climbing:** Automatic ladder/rope detection and center snapping
- **Digging:** Strategic hole placement with 3-second regeneration
- **Collection:** Collision-based gold pickup system

### Guard Behavior
- **AI Pathfinding:** Intelligent navigation with obstacle avoidance
- **Level Traversal:** Guards actively seek ladders when player is on different levels
- **Trap Mechanics:** Guards fall into holes and have limited escape time
- **Collision System:** Horizontal plane detection for safe head-stepping

### Level Design
- **Progressive Difficulty:** Multiple levels with increasing complexity
- **Strategic Elements:** Solid blocks prevent digging in key locations
- **Completion Goals:** Collect all gold to unlock exit ladder

## 🔄 Development Process

This project was built using **Claude Code**, Anthropic's AI-powered development tool:

1. **Foundation (Days 1-2):** Project setup and core engine
2. **World Building (Days 3-4):** Level rendering and collision systems
3. **Player Character (Day 5):** Movement physics and climbing mechanics  
4. **Core Gameplay (Day 6):** Hole digging, gold collection, level progression
5. **Guard AI (Day 7):** Complete AI system with 11 states and pathfinding
6. **Integration (Day 8):** UI polish, audio integration, deployment setup
7. **Deployment (Day 9):** Multi-platform deployment and optimization

**Total Development Time:** 9 days  
**Lines of Code Written Manually:** 0  
**AI Collaboration Tool:** Claude Code

## 🔍 Current Status & Future Improvements

### ✅ Completed Features
- Complete core gameplay mechanics
- Advanced Guard AI with pathfinding
- Full collision and physics system
- Multi-level progression
- Audio/visual integration
- Dual-platform deployment

### 🚧 Areas for Future Enhancement
- **Enhanced Guard AI:** More sophisticated chasing strategies and behaviors
- **Additional Levels:** Expanded level progression system with more complexity
- **Visual Effects:** Particle systems and enhanced animations
- **Mobile Controls:** Touch-based input system optimization
- **Performance:** Further optimization for smoother gameplay experience

## 📄 License

MIT License - See LICENSE file for details.

## 🤖 AI Development Credits

This project was created entirely through AI-assisted development using Claude Code. It serves as a demonstration of modern AI capabilities in game development, showing how complex, feature-rich games can be built through natural language collaboration with AI systems.

**Developed with:** [Claude Code](https://claude.ai/code) by Anthropic