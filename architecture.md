# 🏗️ Lode Runner Clone - Architecture Overview

## **Core Architecture Pattern: Scene-Entity-Manager**

```
┌─────────────────────────────────────────────────────┐
│                   Phaser Game                        │
├─────────────────────────────────────────────────────┤
│                     Scenes                           │
│  ┌────────┐ ┌─────────┐ ┌──────┐ ┌──────────┐     │
│  │ Boot   │→│ Preload │→│ Menu │→│   Game   │     │
│  └────────┘ └─────────┘ └──────┘ └──────────┘     │
│                                    ↓                 │
│                              ┌──────────┐           │
│                              │ GameOver │           │
│                              └──────────┘           │
├─────────────────────────────────────────────────────┤
│                    Entities                          │
│  ┌──────────────┐                                   │
│  │ BaseEntity   │ (Abstract parent class)           │
│  └──────┬───────┘                                   │
│         ├─────────┐      ┌─────────┐               │
│    ┌────▼───┐ ┌───▼──┐  │         │               │
│    │ Player │ │ Guard │  │  Holes  │               │
│    └────────┘ └───────┘  └─────────┘               │
├─────────────────────────────────────────────────────┤
│                   Managers                           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Asset   │ │  Input   │ │  Sound   │           │
│  │ Manager  │ │ Manager  │ │ Manager  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
├─────────────────────────────────────────────────────┤
│                    Utils                             │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐           │
│  │  Logger  │ │ClimbValid│ │HoleTime  │           │
│  └──────────┘ └──────────┘ └──────────┘           │
└─────────────────────────────────────────────────────┘
```

## **Directory Structure Analysis**

### **1. Scenes Layer** (`/src/scenes/`)
- **BootScene**: Initial setup and configuration
- **PreloadScene**: Asset loading with progress bar
- **MenuScene**: Main menu and game start
- **GameScene**: Core gameplay loop (**1,871 lines** - needs refactoring)
- **GameOverScene**: End game state and restart

### **2. Entity System** (`/src/entities/`)
- **BaseEntity**: Abstract parent providing common physics/animation
- **Player**: Player-specific mechanics (climbing, digging, collision)
- **Guard**: AI behavior with 11 animation states and pathfinding
- *Missing*: Hole entity (currently managed in GameScene)

### **3. Manager Pattern** (`/src/managers/`)
- **AssetManager**: Centralized asset loading and access
- **InputManager**: Keyboard input handling and mapping
- **SoundManager**: Audio playback and management

### **4. Utilities** (`/src/utils/`)
- **Logger**: Environment-aware logging
- **ClimbValidation**: Ladder/rope climbing logic
- **HoleTimeline**: Hole lifecycle management

### **5. Configuration** (`/src/config/`)
- **GameConfig**: Centralized game constants and settings

### **6. Systems** (`/src/systems/`)
- **Currently Empty**: Planned but not implemented

## **Architectural Strengths** ✅
1. **Entity inheritance hierarchy** - Clean OOP design
2. **Manager pattern** - Separation of concerns
3. **Scene flow** - Well-defined game state transitions
4. **Type safety** - TypeScript throughout
5. **Asset organization** - Clear public/assets structure

## **Architectural Weaknesses** ⚠️

### 🚨 **Critical Finding: GameScene Monolith**
- **Current size**: 1,871 lines (52+ methods)
- **Best practice**: 300-500 lines max
- **Impact**: Unmaintainable, untestable, tightly coupled

### **Current Responsibilities (Anti-Pattern)**
1. **Level Management** - Tilemap parsing, tile collision setup
2. **Hole System** - Digging, filling, restoration, timers
3. **Exit System** - Ladder reveal, completion detection
4. **Collision System** - Player-guard, guard-guard, tile collisions
5. **UI Management** - Score, lives, gold count display
6. **Debug System** - Overlays, debug text, visualization
7. **Entity Creation** - Player and guard instantiation
8. **Game State** - Score tracking, level progression
9. **Input Handling** - Pause, debug toggle
10. **Audio Triggers** - Sound effect coordination

## 🏗️ **Proposed System Extraction Strategy**

### **Phase 1: Extract Core Systems** (Highest Impact)

#### **1. HoleSystem** (`/src/systems/HoleSystem.ts`)
```typescript
export class HoleSystem {
  private holes: Map<string, HoleData>;
  private holeTimeline: HoleTimeline;
  
  digHole(x: number, y: number, direction: 'left' | 'right'): void
  fillHole(key: string): void
  restoreHole(key: string): void
  checkHoleCollisions(player: Player, guards: Guard[]): void
  update(time: number, delta: number): void
}
```

#### **2. LevelSystem** (`/src/systems/LevelSystem.ts`)
```typescript
export class LevelSystem {
  private tilemap: Phaser.Tilemaps.Tilemap;
  private solidTiles: Phaser.Physics.Arcade.StaticGroup;
  
  loadLevel(levelData: any): void
  createTilemap(tiles: number[][]): void
  getTileAt(x: number, y: number): TileType
  isTileDiggable(x: number, y: number): boolean
}
```

#### **3. ExitSystem** (`/src/systems/ExitSystem.ts`)
```typescript
export class ExitSystem {
  private exitLadderSprites: Phaser.GameObjects.Sprite[];
  private exitMarker: Phaser.GameObjects.Text;
  
  checkGoldCollected(): boolean
  revealExitLadder(): void
  checkExitReached(player: Player): boolean
}
```

### **Phase 2: Event-Driven Architecture**

#### **EventBus Implementation**
```typescript
// /src/systems/EventBus.ts
export class EventBus extends Phaser.Events.EventEmitter {
  static instance: EventBus;
  
  // Game Events
  static readonly GOLD_COLLECTED = 'gold-collected';
  static readonly HOLE_DUG = 'hole-dug';
  static readonly GUARD_TRAPPED = 'guard-trapped';
  static readonly LEVEL_COMPLETE = 'level-complete';
}
```

### **Phase 3: Registry Pattern**

#### **SystemRegistry** (`/src/systems/SystemRegistry.ts`)
```typescript
export class SystemRegistry {
  private systems: Map<string, BaseSystem>;
  
  register<T extends BaseSystem>(name: string, system: T): void
  get<T extends BaseSystem>(name: string): T
  updateAll(time: number, delta: number): void
}
```

## 📋 **Architectural Improvement Roadmap**

### **🎯 Priority Matrix**

| Priority | System | Complexity | Impact | Lines to Extract |
|----------|--------|------------|--------|------------------|
| **P0** | HoleSystem | High | Critical | ~400 lines |
| **P0** | LevelSystem | Medium | Critical | ~300 lines |
| **P1** | ExitSystem | Low | High | ~150 lines |
| **P1** | CollisionSystem | High | High | ~250 lines |
| **P2** | DebugSystem | Low | Medium | ~200 lines |
| **P2** | UISystem | Low | Medium | ~150 lines |
| **P3** | EventBus | Medium | High | New |
| **P3** | SystemRegistry | Low | Medium | New |

### **📅 Implementation Timeline**

#### **Sprint 1: Core Extraction (Week 1)**
- [ ] Extract HoleSystem with existing HoleTimeline
- [ ] Extract LevelSystem with tilemap management
- [ ] Update GameScene to use new systems
- [ ] Add unit tests for extracted systems

#### **Sprint 2: Game Flow (Week 2)**
- [ ] Extract ExitSystem with completion logic
- [ ] Extract CollisionSystem with physics handling
- [ ] Implement basic EventBus for system communication
- [ ] Reduce GameScene to < 800 lines

#### **Sprint 3: Polish (Week 3)**
- [ ] Extract DebugSystem for dev tools
- [ ] Extract UISystem for HUD management
- [ ] Implement SystemRegistry for centralized updates
- [ ] Add performance monitoring

### **🎨 Target Architecture**

```typescript
// GameScene.ts (After Refactoring) - Target: 500-600 lines
export class GameScene extends Scene {
  private registry: SystemRegistry;
  private eventBus: EventBus;
  
  create() {
    // Initialize systems
    this.registry.register('hole', new HoleSystem(this));
    this.registry.register('level', new LevelSystem(this));
    this.registry.register('exit', new ExitSystem(this));
    
    // Wire event listeners
    this.eventBus.on(EventBus.GOLD_COLLECTED, this.onGoldCollected);
    this.eventBus.on(EventBus.LEVEL_COMPLETE, this.onLevelComplete);
  }
  
  update(time: number, delta: number) {
    this.registry.updateAll(time, delta);
  }
}
```

## **✅ Success Metrics**

1. **Code Quality**
   - GameScene reduced from 1,871 → 500-600 lines
   - Each system < 300 lines
   - Test coverage > 80%

2. **Performance**
   - Maintain 30 FPS target
   - Reduce update loop overhead by 20%
   - Memory usage stable

3. **Maintainability**
   - Single Responsibility Principle achieved
   - Loose coupling via events
   - Clear system boundaries

## **⚠️ Risk Mitigation**

| Risk | Mitigation Strategy |
|------|-------------------|
| Breaking existing gameplay | Incremental extraction with tests |
| Performance regression | Profile before/after each extraction |
| Lost functionality | Maintain feature parity checklist |
| Merge conflicts | Work in feature branches |

## **Technology Stack**
- **Framework**: Phaser.js 3.85+
- **Language**: TypeScript
- **Build**: Vite 6.0+
- **Deployment**: Netlify
- **Testing**: Custom MCP-based test framework

## **Performance Considerations**
- 30 FPS target for smooth animations
- Object pooling needed for transient sprites
- Event-driven architecture would reduce coupling
- System registry pattern for better observability

## 🏆 **Executive Summary**

Your Lode Runner clone has solid foundations but suffers from a **critical architectural debt**: the 1,871-line `GameScene` monolith. The proposed refactoring would:

1. **Extract 6 dedicated systems** from GameScene
2. **Reduce complexity** by 70% (1,871 → 500-600 lines)
3. **Improve testability** through isolated systems
4. **Enable scalability** via event-driven architecture

### **Immediate Action Items**

1. **Start with HoleSystem** - Highest impact, already has HoleTimeline utility
2. **Use feature branches** - Prevent breaking main gameplay
3. **Add tests first** - Ensure behavior preservation
4. **Profile performance** - Monitor 30 FPS target

The empty `/src/systems/` directory shows this refactoring was already planned - now you have a concrete roadmap to execute it.