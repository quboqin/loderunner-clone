import { Scene } from 'phaser';
import { SCENE_KEYS, GAME_CONFIG, GAME_MECHANICS } from '@/config/GameConfig';
import { GameState } from '@/types/GameTypes';
import { SoundManager } from '@/managers/SoundManager';
import { InputManager } from '@/managers/InputManager';
import { Guard, GuardState } from '@/entities/Guard';
import { Player } from '@/entities/Player';
import { GameLogger, GuardLogger } from '@/utils/Logger';
import { ClimbValidation, TileChecker } from '@/utils/ClimbValidation';
import { HoleSystem } from '@/systems/HoleSystem';
import { LevelSystem } from '@/systems/LevelSystem';
import { CollisionSystem } from '@/systems/CollisionSystem';

export class GameScene extends Scene {
  private gameState!: GameState;
  private player!: Player;
  private inputManager!: InputManager;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private soundManager!: SoundManager;
  private guards: Guard[] = [];
  public playerInvincible: boolean = false;
  public invincibilityEndTime: number = 0;
  
  // Core game systems
  private holeSystem!: HoleSystem;
  private levelSystem!: LevelSystem;
  private collisionSystem!: CollisionSystem;
  private climbValidation!: ClimbValidation; // Will be used for Rule 5 climb validation
  
  // Debug visuals - simple on/off system
  private debugMode = false;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;
  private levelCompleting = false;
  
  // Debug logging control - capture first few instances then stop
  private debugLogCount = 0;
  private maxDebugLogs = 10; // Only log first 10 Rule 7 events
  private lastDebugSecond = 0; // Track last second we logged

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  // === PUBLIC GETTERS FOR SYSTEMS ===
  
  public getLevelTiles(): Map<string, Phaser.GameObjects.Sprite> {
    return this.levelSystem.getLevelTiles();
  }
  
  public getPlayer(): Player {
    return this.player;
  }
  
  public getHoleSystem(): HoleSystem {
    return this.holeSystem;
  }
  
  public getCollisionSystem(): CollisionSystem {
    return this.collisionSystem;
  }
  
  public getLevelSystem(): LevelSystem {
    return this.levelSystem;
  }
  
  public getInputManager(): InputManager {
    return this.inputManager;
  }
  
  public getLadderTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.collisionSystem.getLadderTiles();
  }
  
  public getRopeTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.collisionSystem.getRopeTiles();
  }
  
  public getSolidTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.collisionSystem.getSolidTiles();
  }
  
  public getSoundManager(): SoundManager {
    return this.soundManager;
  }

  create(): void {
    
    
    this.initializeGameState();
    this.initializeAudio();
    this.initializeTimelineSystem(); // Initialize timeline-based hole mechanics
    this.initializeClimbValidation(); // Initialize climb validation for hole escape
    this.setupInput(); // Initialize InputManager before creating Player
    this.collisionSystem.initializePhysicsWorld();
    this.collisionSystem.initializePhysicsGroups();
    this.levelSystem.loadLevel(this.gameState.currentLevel, this.gameState);
    this.createPlayer();
    this.createGuards(); // Create guards after player
    this.createUI();
    this.collisionSystem.setupEntityCollisions();
    this.initializeDebug();
    
    // Add brief invincibility when level starts (after death)
    this.addStartupInvincibility();
    
  }

  private initializeAudio(): void {
    this.soundManager = SoundManager.getInstance(this);
    this.soundManager.initializeSounds();
  }

  // Initialize game systems
  private initializeTimelineSystem(): void {
    this.holeSystem = new HoleSystem(this);
    this.levelSystem = new LevelSystem(this);
    this.collisionSystem = new CollisionSystem(this);
  }
  
  // Initialize climb validation system for hole escape mechanics
  private initializeClimbValidation(): void {
    // Create TileChecker implementation for ClimbValidation
    const tileChecker: TileChecker = {
      isTileStandable: (gridX: number, gridY: number): boolean => {
        return this.levelSystem.isTileStandable(gridX, gridY);
      },
      
      isTileSolid: (gridX: number, gridY: number): boolean => {
        return this.levelSystem.isTileSolid(gridX, gridY);
      },
      
      getTileType: (gridX: number, gridY: number): number => {
        return this.levelSystem.getTileType(gridX, gridY);
      }
    };
    
    this.climbValidation = new ClimbValidation(tileChecker);
  }

  // TileChecker implementation methods

  // Rule 8: Handle player standing on guard platform
  public handlePlayerOnGuardPlatform(): void {
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    
    // Provide solid platform support
    if (playerBody) {
      // Stop vertical movement if falling onto platform
      if (playerBody.velocity.y > 0) {
        playerBody.setVelocityY(0);
      }
      
      // Disable gravity while standing on guard platform
      playerBody.setGravityY(0);
      
      // Ensure player doesn't sink through platform
      playerBody.moves = true;
      
      // Debug logging
      GameLogger.debug(`Player standing on guard platform - gravity disabled`);
    }
  }

  // Rule 8: Check if player is still on guard platform and manage gravity accordingly
  private updatePlayerGuardPlatformState(): void {
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    
    if (!playerBody) {
      return;
    }

    // Check if player is currently standing on any guard platform
    const playerOnGuardPlatform = this.guards.some(guard => {
      return guard.isEntityOnTop(this.player.sprite);
    });

    // Check player climbing state to avoid gravity conflicts
    const climbingState = this.player.getClimbingState();
    const isClimbing = climbingState.onLadder || climbingState.onRope;

    if (playerOnGuardPlatform) {
      // Player is on guard platform - handle platform physics
      this.handlePlayerOnGuardPlatform();
    } else if (!isClimbing && playerBody.gravity.y === 0) {
      // Player not on platform and not climbing but has no gravity - restore it
      // This handles the case where player moves off a guard platform
      playerBody.setGravityY(800);
      GameLogger.debug(`Player left guard platform - gravity restored`);
    }
  }

  private initializeDebug(): void {
    // Create debug graphics for visual overlays
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(GAME_MECHANICS.DEPTHS.DEBUG_GRAPHICS); // Render on top of everything
    
    // Create debug text display
    this.debugText = this.add.text(GAME_MECHANICS.UI.DEBUG_TEXT_X, GAME_MECHANICS.UI.DEBUG_TEXT_Y, '', {
      fontSize: '14px',
      color: '#00ff00',
      fontFamily: 'monospace',
      backgroundColor: '#000000aa',
      padding: { x: 8, y: 4 }
    });
    this.debugText.setDepth(1001);
    
    // Initially hidden
    this.debugGraphics.setVisible(false);
    this.debugText.setVisible(false);
  }


  private initializeGameState(): void {
    // Preserve lives and current level when restarting, but reset level-specific state
    const preservedLives = this.gameState?.lives ?? 3;
    const preservedLevel = this.gameState?.currentLevel ?? 1;
    const preservedScore = this.gameState?.score ?? 0;
    
    this.gameState = {
      currentLevel: preservedLevel,
      score: preservedScore, 
      lives: preservedLives,
      goldCollected: 0, // Reset for this level
      totalGold: 0 // Will be set when level loads
    };
    
    // Store gameState in registry so systems can access it
    this.registry.set('gameState', this.gameState);
    
    GameLogger.debug(`Game state initialized - Level: ${preservedLevel}, Lives: ${preservedLives}, Score: ${preservedScore}`);
    
    // Initialize invincibility state
    this.playerInvincible = false;
    this.invincibilityEndTime = 0;

    // Reset exit state is now handled by LevelSystem cleanup
    this.levelCompleting = false;
  }




  private createPlayer(): void {
    const startPos = this.registry.get('playerStart') || { x: 400, y: 400 };
    
    // Create Player entity
    const playerConfig = {
      scene: this,
      x: startPos.x,
      y: startPos.y,
      texture: 'runner',
      frame: 'runner_00'
    };
    
    this.player = new Player(playerConfig, this.inputManager, this.soundManager);
    
    GameLogger.debug(`Player created at position (${startPos.x}, ${startPos.y})`);
  }

  private createGuards(): void {
    // Clear existing guards first (in case of recreation)
    if (this.guards && this.guards.length > 0) {
      GuardLogger.debug(`Destroying ${this.guards.length} existing guards before creating new ones`);
      this.guards.forEach(guard => guard.destroy());
      this.guards = [];
    }
    
    // Use cached level data from LevelSystem
    const levelInfo = this.levelSystem.getLevelInfo();
    if (!levelInfo) {
      GuardLogger.error('Level data not parsed yet! loadLevel() should be called before createGuards()');
      return;
    }
    
    // Create guard AI entities
    GuardLogger.debug(`Creating ${levelInfo.guards.length} guards for level ${this.gameState.currentLevel}`);
    levelInfo.guards.forEach((guardPos: { x: number; y: number }, index: number) => {
      GuardLogger.debug(`Creating guard ${index} at position (${guardPos.x + GAME_CONFIG.halfTileSize}, ${guardPos.y + GAME_CONFIG.halfTileSize})`);
      const guard = new Guard(this, guardPos.x + GAME_CONFIG.halfTileSize, guardPos.y + GAME_CONFIG.halfTileSize, this.player.sprite);
      guard.setCollisionCallbacks(this.getLadderTiles(), this.getRopeTiles(), this.getSolidTiles());
      
      // Pass ClimbValidation instance for hole escape mechanics
      guard.setClimbValidation(this.climbValidation);
      
      this.guards.push(guard);
    });
    
    // Set up guard-to-guard collision detection to prevent overlapping
    this.collisionSystem.setupGuardCollisions(this.guards);
    
    GuardLogger.debug(`Total guards created: ${this.guards.length}`);
  }




  private createUI(): void {
    const padding = 20;
    const gameAreaHeight = GAME_CONFIG.levelHeight * GAME_CONFIG.tileSize; // 512px
    const uiStartY = gameAreaHeight + 10; // Start UI 10px below game area
    
    // Position game info elements below the game playing area
    this.scoreText = this.add.text(padding, uiStartY, `SCORE: ${this.gameState.score}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.levelText = this.add.text(padding + 200, uiStartY, `LEVEL: ${this.gameState.currentLevel}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.livesText = this.add.text(padding + 400, uiStartY, `LIVES: ${this.gameState.lives}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.goldText = this.add.text(GAME_CONFIG.width - padding, uiStartY, 
      `GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`, {
      fontSize: '24px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0).setDepth(2000);

    // Position instructions below the game info
    this.add.text(padding, uiStartY + 35, 
      'ESC - Menu  |  Arrow Keys - Move  |  Z/X - Dig  |  J - Debug', {
      fontSize: '16px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    });
  }

  private setupInput(): void {
    // Initialize InputManager for centralized input handling
    this.inputManager = new InputManager(this);
  }

  private updateCounter = 0;

  update(time: number, delta: number): void {
    try {
      this.updateCounter++;
      
      // CRITICAL FIX: Use this.time.now for consistent timing across all systems
      const gameTime = this.time.now;
      
      // CRITICAL: Check guard deaths BEFORE updating timeline
      // This ensures timeline data exists for death checks
      this.checkTimelineBasedGuardDeaths(gameTime);
      
      // Update game systems
      this.holeSystem.update(gameTime, delta);
      this.levelSystem.update(gameTime, delta);
      
      // Handle input through InputManager
      this.handleInput();
      
      // Update Player entity
      this.player.update(time, delta);
      
      this.updateUI();
      this.updatePlayerState();
      this.updateGuards(gameTime, delta);  // Use consistent gameTime
      this.collisionSystem.checkGuardPlayerCollisions(this.guards, this.player, this);
      
      if (this.debugMode) {
        this.updateDebugVisuals();
      }
    } catch (error) {
      // Handle error silently
    }
  }

  private handleInput(): void {
    // Handle ESC key - return to menu
    if (this.inputManager.isEscapePressed()) {
      this.scene.start(SCENE_KEYS.MENU);
    }

    // Handle digging controls
    if (this.inputManager.isDigLeftPressed()) {
      this.player.digLeft();
      this.holeSystem.digHole('left');
    }

    if (this.inputManager.isDigRightPressed()) {
      this.player.digRight();
      this.holeSystem.digHole('right');
    }

    // Handle debug toggle
    if (this.inputManager.isDebugTogglePressed()) {
      this.toggleDebugMode();
    }
  }

  private updatePlayerState(): void {
    // Check ladder/rope state using continuous position-based detection
    this.updateClimbableState();
    
    // Rule 8: Check if player is still on guard platform, restore gravity if not
    this.updatePlayerGuardPlatformState();
    
    // Check for holes player might fall through
    this.holeSystem.checkPlayerHoleCollisions(this.player);
    
    // Check for exit ladder completion
    const playerGridX = Math.floor(this.player.sprite.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(this.player.sprite.y / GAME_CONFIG.tileSize);
    if (this.levelSystem.checkExitCompletion(playerGridX, playerGridY)) {
      this.completeLevel();
    }
  }

  private updateClimbableState(): void {
    // Enhanced ladder detection with multiple contact points
    const playerCenterX = this.player.sprite.x;
    const playerCenterY = this.player.sprite.y;
    
    // Calculate detection points - center, bottom, and top areas of player
    const playerHalfHeight = this.player.sprite.displayHeight / 2;
    const detectionPoints = [
      // Player center - primary detection point
      { x: playerCenterX, y: playerCenterY },
      // Near bottom of player - for standing on ladder rungs
      { x: playerCenterX, y: playerCenterY + (playerHalfHeight * 0.7) },
      // Near top of player - for reaching ladder tops
      { x: playerCenterX, y: playerCenterY - (playerHalfHeight * 0.7) }
    ];
    
    
    // Reset climbing states
    let onLadder = false;
    let onRope = false;
    
    // Track which detection points find ladders/ropes for debugging
    let detectionResults: string[] = [];
    
    // Variables for detection logic
    
    // Check each detection point against all ladder tiles
    detectionPoints.forEach((point, index) => {
      const tileX = Math.floor(point.x / GAME_CONFIG.tileSize);
      const tileY = Math.floor(point.y / GAME_CONFIG.tileSize);
      
      let foundLadder = false;
      
      // Check all ladder tiles - use all detection points for ladders
      this.getLadderTiles().children.entries.forEach((tile: any) => {
        // Account for tile positioning: tiles are positioned at center (pixelX + halfTileSize, pixelY + halfTileSize)
        // So to get tile grid coordinates, we need to subtract halfTileSize before dividing
        const tileTileX = Math.floor((tile.x - GAME_CONFIG.halfTileSize) / GAME_CONFIG.tileSize);
        const tileTileY = Math.floor((tile.y - GAME_CONFIG.halfTileSize) / GAME_CONFIG.tileSize);
        
        
        // Check if this detection point overlaps with ladder tile
        if (tileTileX === tileX && tileTileY === tileY) {
          // Always detect ladder when player is positioned on one
          // This allows proper detection at ladder tops without requiring input
          onLadder = true;
          foundLadder = true;
          
        }
      });
      
      // Store detection results for debug display
      const pointNames = ['Center', 'Bottom', 'Top'];
      if (foundLadder) {
        detectionResults.push(`${pointNames[index]}(L)`);
      }
    });
    
    // Rope detection - Use player center for consistent rope detection during movement
    const playerTileX = Math.floor(playerCenterX / GAME_CONFIG.tileSize);
    const playerTileY = Math.floor(playerCenterY / GAME_CONFIG.tileSize);
    let ropeY: number | undefined = undefined;
    
    // Don't detect rope if player is jumping from rope
    const jumpingFromRope = false;
    if (!jumpingFromRope) {
      this.getRopeTiles().children.entries.forEach((tile: any) => {
        // Account for tile positioning: tiles are positioned at center (pixelX + halfTileSize, pixelY + halfTileSize)
        const tileTileX = Math.floor((tile.x - GAME_CONFIG.halfTileSize) / GAME_CONFIG.tileSize);
        const tileTileY = Math.floor((tile.y - GAME_CONFIG.halfTileSize) / GAME_CONFIG.tileSize);
        
        // Check if player center is at the same tile position as rope
        // This ensures consistent detection during horizontal movement
        if (tileTileX === playerTileX && tileTileY === playerTileY) {
          onRope = true;
          ropeY = tile.y; // Use the actual rope tile's Y position for proper alignment
          detectionResults.push('Center(R)');
        }
      });
    }
    
    // Store detection results for debug display
    this.player.setDetectionResults(detectionResults);
    
    // Priority system: Rope takes priority over ladder when both are detected
    // This allows natural ladder-to-rope transitions at the top of ladders
    if (onRope && onLadder) {
      // When both rope and ladder are detected, prioritize rope
      onLadder = false;
      detectionResults.push('RopePriority');
    }
    
    // Update player data - pass rope Y position for proper alignment
    this.player.setClimbableState(onLadder, onRope, ropeY);
  }
  

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.gameState.score}`);
    this.levelText.setText(`LEVEL: ${this.gameState.currentLevel}`);
    this.livesText.setText(`LIVES: ${this.gameState.lives}`);
    this.goldText.setText(`GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`);
  }








  




  private completeLevel(): void {
    if (this.levelCompleting) {
      return;
    }
    this.levelCompleting = true;

    // Exit marker cleanup now handled by LevelSystem
    
    // Play level completion music (safe)
    try {
      this.soundManager.playLevelComplete();
    } catch {}
    
    // Add level completion bonus once
    this.gameState.score += 1000;
    
    // Show level complete message
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    const completeText = this.add.text(centerX, centerY, `LEVEL ${this.gameState.currentLevel} COMPLETE!`, {
      fontSize: '48px',
      color: '#ffff00',
      fontFamily: 'Arial, sans-serif',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Proceed to next level after showing message
    const proceed = () => {
      try { completeText.destroy(); } catch {}
      this.loadNextLevel();
    };

    // Primary delay and fallback to ensure transition
    this.time.delayedCall(1200, proceed);
    this.time.delayedCall(3000, () => {
      if (this.levelCompleting) {
        proceed();
      }
    });
  }

  private loadNextLevel(): void {
    // Increment current level
    this.gameState.currentLevel++;
    
    // Check if next level exists (assuming levels go up to 150 based on classic.json)
    const maxLevels = 150;
    if (this.gameState.currentLevel > maxLevels) {
      // Game completed - could show victory screen or restart from level 1
      this.gameState.currentLevel = 1;
    }
    
    // Restart scene with new level and reset completion flag immediately
    this.scene.restart();
    this.levelCompleting = false;
  }

  private toggleDebugMode(): void {
    this.debugMode = !this.debugMode;
    this.debugGraphics.setVisible(this.debugMode);
    this.debugText.setVisible(this.debugMode);
    
    if (!this.debugMode) {
      this.debugGraphics.clear();
    }
  }

  private updateDebugVisuals(): void {
    if (!this.player || !this.debugMode) return;
    
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    this.debugGraphics.clear();
    
    // 1. Red Rectangle: Visual sprite bounds
    const spriteBounds = {
      x: this.player.sprite.x - this.player.sprite.displayWidth / 2,
      y: this.player.sprite.y - this.player.sprite.displayHeight / 2,
      width: this.player.sprite.displayWidth,
      height: this.player.sprite.displayHeight
    };
    this.debugGraphics.lineStyle(3, 0xff0000, 1);
    this.debugGraphics.strokeRect(spriteBounds.x, spriteBounds.y, spriteBounds.width, spriteBounds.height);
    
    // 2. Blue Rectangle: Collision body bounds
    const bodyBounds = {
      x: playerBody.x,
      y: playerBody.y,
      width: playerBody.width,
      height: playerBody.height
    };
    this.debugGraphics.lineStyle(3, 0x0000ff, 1);
    this.debugGraphics.strokeRect(bodyBounds.x, bodyBounds.y, bodyBounds.width, bodyBounds.height);
    
    // 3. Green Grid: Tile grid overlay (around player)
    const tileSize = GAME_CONFIG.tileSize;
    const playerTileX = Math.floor(this.player.sprite.x / tileSize);
    const playerTileY = Math.floor(this.player.sprite.y / tileSize);
    
    // Draw 3x3 grid around player
    for (let tx = playerTileX - 1; tx <= playerTileX + 1; tx++) {
      for (let ty = playerTileY - 1; ty <= playerTileY + 1; ty++) {
        const tileX = tx * tileSize;
        const tileY = ty * tileSize;
        this.debugGraphics.lineStyle(1, 0x00ff00, 0.6);
        this.debugGraphics.strokeRect(tileX, tileY, tileSize, tileSize);
      }
    }
    
    // 4. Yellow Dot: Sprite center point
    this.debugGraphics.lineStyle(0, 0x000000, 0);
    this.debugGraphics.fillStyle(0xffff00, 1);
    this.debugGraphics.fillCircle(this.player.sprite.x, this.player.sprite.y, 4);
    
    // 5. Orange Dot: Body center point
    const bodyCenterX = playerBody.x + playerBody.width / 2;
    const bodyCenterY = playerBody.y + playerBody.height / 2;
    this.debugGraphics.fillStyle(0xff8800, 1);
    this.debugGraphics.fillCircle(bodyCenterX, bodyCenterY, 3);
    
    // Update debug text with all coordinate information
    this.updateDebugText(playerBody, bodyCenterX, bodyCenterY);
  }

  private updateDebugText(playerBody: Phaser.Physics.Arcade.Body, bodyCenterX: number, bodyCenterY: number): void {
    const climbingState = this.player.getClimbingState();
    const isClimbing = climbingState.onLadder || climbingState.onRope;
    
    // Calculate current tile position
    const tileX = Math.floor(this.player.sprite.x / GAME_CONFIG.tileSize);
    const tileY = Math.floor(this.player.sprite.y / GAME_CONFIG.tileSize);
    
    // Track position changes for debugging sliding (simplified)
    const positionDelta = { x: 0, y: 0 };
    
    // Store current position for next frame comparison
    // TODO: Track previous position in Player entity if needed
    
    const debugInfo = [
      'DEBUG MODE - All Sprite & Body Coordinates',
      '(Press J to toggle off)',
      '',
      '=== SPRITE INFORMATION ===',
      `Sprite Center (x,y): (${this.player.sprite.x.toFixed(1)}, ${this.player.sprite.y.toFixed(1)})`,
      `Sprite Size: ${this.player.sprite.displayWidth.toFixed(1)} x ${this.player.sprite.displayHeight.toFixed(1)}`,
      `Sprite Scale: ${this.player.sprite.scaleX}`,
      `Current Tile: (${tileX}, ${tileY})`,
      '',
      '=== COLLISION BODY INFORMATION ===',
      `Body Position (x,y): (${playerBody.x.toFixed(1)}, ${playerBody.y.toFixed(1)})`,
      `Body Center (x,y): (${bodyCenterX.toFixed(1)}, ${bodyCenterY.toFixed(1)})`,
      `Body Size: ${playerBody.width} x ${playerBody.height}`,
      `Body Offset: (${playerBody.offset.x}, ${playerBody.offset.y})`,
      '',
      '=== PHYSICS INFORMATION ===',
      `Velocity: (${playerBody.velocity.x.toFixed(1)}, ${playerBody.velocity.y.toFixed(1)})`,
      `Acceleration: (${playerBody.acceleration.x.toFixed(1)}, ${playerBody.acceleration.y.toFixed(1)})`,
      `Gravity: ${playerBody.gravity.y}`,
      `Blocked: ${JSON.stringify(playerBody.blocked)}`,
      '',
      '=== CLIMBING STATE ===',
      `On Ladder: ${climbingState.onLadder ? '✓' : '✗'}`,
      `On Rope: ${climbingState.onRope ? '✓' : '✗'}`,
      `Is Climbing: ${isClimbing ? '✓' : '✗'}`,
      `Gravity Disabled: ${playerBody.gravity.y === 0 ? '✓' : '✗'}`,
      `Detection Points: ${this.player.getDetectionResults()?.join(', ') || 'None'}`,
      '',
      '=== MOVEMENT TRACKING ===',
      `Position Delta: (${positionDelta.x.toFixed(2)}, ${positionDelta.y.toFixed(2)})`,
      `Moving Despite 0 Velocity: ${(Math.abs(positionDelta.x) > 0.01 || Math.abs(positionDelta.y) > 0.01) && playerBody.velocity.x === 0 && playerBody.velocity.y === 0 ? '⚠️ YES' : 'No'}`,
      `Body Moves Enabled: ${playerBody.moves ? '✓' : '🔒 LOCKED'}`,
      '',
      '=== CLIMB VALIDATION SYSTEM ===',
      `ClimbValidation Active: ${this.climbValidation ? '✓' : '✗'}`,
      '',
      '=== VISUAL LEGEND ===',
      'RED: Sprite bounds (visual)',
      'BLUE: Collision body (physics)',
      'GREEN: Tile grid (32x32)',
      'YELLOW: Sprite center',
      'ORANGE: Body center'
    ];
    
    this.debugText.setText(debugInfo.join('\n'));
  }

  private updateGuards(gameTime: number, delta: number): void {
    this.guards.forEach(guard => {
      guard.update(gameTime, delta);  // Pass consistent gameTime to guard
      this.holeSystem.checkGuardHoleCollisions(guard, gameTime);
      this.updateGuardClimbableState(guard);
      
      // Rule 8: Check for guard-to-guard platform interactions
      this.checkGuardPlatformInteractions(guard);
    });
  }

  // Rule 8: Handle guard-to-guard platform mechanics
  private checkGuardPlatformInteractions(guard: Guard): void {
    if (guard.getState() !== GuardState.RUNNING_LEFT && guard.getState() !== GuardState.RUNNING_RIGHT) {
      return; // Only check for moving guards
    }

    // Check if this guard is standing on another guard in a hole
    const guardOnPlatform = this.guards.find(platformGuard => {
      if (platformGuard === guard) return false; // Don't check against self
      return platformGuard.isEntityOnTop(guard.sprite);
    });

    if (guardOnPlatform) {
      // Rule 8: This guard is standing on another guard - provide platform physics
      const guardBody = guard.sprite.body as Phaser.Physics.Arcade.Body;
      
      if (guardBody && guardBody.velocity.y > 0) {
        // Stop falling if landing on guard platform
        guardBody.setVelocityY(0);
      }
      
      GameLogger.debug(`Guard ${guard.getGuardId()} standing on guard ${guardOnPlatform.getGuardId()} platform`);
    }
  }

  // Check for timeline-based guard deaths (Rule 7)
  private checkTimelineBasedGuardDeaths(currentTime: number): void {
    // Get all active hole timelines using proper public method
    const activeTimelines = this.holeSystem.getHoleTimeline().getAllActiveTimelines();
    
    // Only log debug info for first few guards in holes
    if (this.debugLogCount < this.maxDebugLogs) {
      const guardsInAnyHole = this.guards.filter(g => g.getCurrentHole() !== null);
      if (guardsInAnyHole.length > 0) {
        // Log only once per second to reduce spam
        const secondsElapsed = Math.floor(currentTime / 1000);
        if (this.lastDebugSecond !== secondsElapsed) {
          this.lastDebugSecond = secondsElapsed;
          
          guardsInAnyHole.forEach(guard => {
            const holeKey = guard.getCurrentHole();
            const timeline = this.holeSystem.getHoleTimeline().getHoleTimeline(holeKey!);
            if (timeline) {
              const timeUntilClose = (timeline.t2 - currentTime) / 1000;
              const guardFallTime = guard.getFallTime();
              const stunEndTime = guard.getStunEndTime();
              const shouldDie = guard.shouldDieFromHole(timeline.t2);
              
              this.debugLogCount++;
              GameLogger.debug(`[RULE 7 DEBUG] Guard ${guard.getGuardId()} in hole ${holeKey}:
                - Current time: ${currentTime}
                - Fall time (tg1): ${guardFallTime}
                - Stun end (tg1+m): ${stunEndTime}
                - Hole close (t2): ${timeline.t2}
                - Time until close: ${timeUntilClose.toFixed(1)}s
                - Should die: ${shouldDie} (${stunEndTime} >= ${timeline.t2} = ${stunEndTime >= timeline.t2})
                (Log ${this.debugLogCount}/${this.maxDebugLogs})`);
            } else {
              this.debugLogCount++;
              GameLogger.warn(`[RULE 7 ERROR] Guard ${guard.getGuardId()} in hole ${holeKey} but NO TIMELINE FOUND!
                (Log ${this.debugLogCount}/${this.maxDebugLogs})`);
            }
          });
        }
      }
    }
    
    // Check each active hole timeline for guards that should die
    for (const [holeKey, timeline] of activeTimelines) {
      const holeCloseTime = timeline.t2;
      const shouldFillHole = currentTime >= holeCloseTime; // Check if it's time to fill hole
      
      // Find guards in this hole that should die based on Rule 7
      const guardsInHole = this.guards.filter(guard => guard.getCurrentHole() === holeKey);
      
      let anyGuardShouldDie = false;
      for (const guard of guardsInHole) {
        if (guard.shouldDieFromHole(holeCloseTime)) {
          anyGuardShouldDie = true;
          
          // Only kill guard if not already dying
          if (guard.getState() !== GuardState.REBORN) {
            // Always log deaths (they're critical and rare)
            GameLogger.debug(`[RULE 7 DEATH] Killing guard ${guard.getGuardId()} in hole ${holeKey}`);
            
            // Remove guard from timeline tracking
            this.holeSystem.getHoleTimeline().removeGuardFromHole(holeKey, guard.getGuardId());
            
            // Execute guard death and respawn
            guard.executeTimelineBasedDeath();
          }
        }
      }
      
      // If we're at or past t2 AND guards should die in this hole, trigger fill
      if (shouldFillHole && (anyGuardShouldDie || guardsInHole.length === 0)) {
        // Parse hole coordinates from key
        const [gridXStr, gridYStr] = holeKey.split(',');
        const gridX = parseInt(gridXStr);
        const gridY = parseInt(gridYStr);
        
        // Check if hole still exists and trigger fill
        if (this.holeSystem.getHoles().has(holeKey)) {
          GameLogger.debug(`[HOLE FILL SYNC] Triggering immediate hole fill for ${holeKey} at t2`);
          this.holeSystem.fillHole(gridX, gridY);
        }
      }
    }
  }
  


  private handlePlayerDeath(): void {
    GameLogger.debug(`Player death - Lives: ${this.gameState.lives} → ${this.gameState.lives - 1}`);
    
    // Handle player death
    this.gameState.lives -= 1;
    
    // Play death sound
    this.player.die();
    
    if (this.gameState.lives <= 0) {
      GameLogger.info('Game Over - All lives lost');
      // Game over - go to menu
      this.scene.start(SCENE_KEYS.MENU);
    } else {
      GameLogger.debug('Restarting level - Lives remaining: ' + this.gameState.lives);
      // Restart the level (preserving lives and current level)
      this.scene.restart();
    }
  }

  private addStartupInvincibility(): void {
    // Give player brief invincibility when level starts
    // (especially useful after death/restart)
    this.playerInvincible = true;
    this.invincibilityEndTime = this.time.now + 2000; // 2 seconds
    this.player.activateInvincibility(2000); // Use Player entity's invincibility system
    
    GameLogger.debug('Startup invincibility activated for 2 seconds');
  }
  
  /**
   * End player invincibility period - used by CollisionSystem delegation
   */
  public endPlayerInvincibility(): void {
    this.playerInvincible = false;
    this.player.sprite.setAlpha(1.0);
  }



  private updateGuardClimbableState(guard: Guard): void {
    // Reset climbable flags each frame
    guard.setClimbableState(false, false);
    
    // Check if guard is overlapping with ladders
    const ladderOverlap = this.physics.overlap(guard.sprite, this.getLadderTiles());
    if (ladderOverlap) {
      guard.setClimbableState(true, false);
    }
    
    // Check if guard is overlapping with ropes
    const ropeOverlap = this.physics.overlap(guard.sprite, this.getRopeTiles());
    if (ropeOverlap) {
      guard.setClimbableState(guard.canClimb(), true);
    }
  }

  destroy(): void {
    // Clean up hole system
    if (this.holeSystem) {
      this.holeSystem.cleanup();
    }
    
    // Clean up guards
    if (this.guards) {
      this.guards.forEach(guard => {
        guard.destroy();
      });
      this.guards = [];
    }
    
    // Level tiles cleanup now handled by LevelSystem
  }
  
  // === DELEGATION METHODS FOR HOLESYSTEM ===
  
  /**
   * Check if there are guards in a specific hole
   * Used by HoleSystem to handle player-guard hole interactions
   */
  public hasGuardsInHole(holeKey: string): boolean {
    const guards = this.guards.filter(guard => 
      guard.getCurrentHole() === holeKey && 
      (guard.getState() === GuardState.IN_HOLE || guard.getState() === GuardState.STUNNED_IN_HOLE)
    );
    return guards.length > 0;
  }
  
  /**
   * Check if player is standing on top of guards in a hole
   * Used by HoleSystem for Rule 8 platform mechanics
   */
  public isPlayerOnGuardInHole(holeKey: string): boolean {
    const guardsInHole = this.guards.filter(guard => 
      guard.getCurrentHole() === holeKey && 
      (guard.getState() === GuardState.IN_HOLE || guard.getState() === GuardState.STUNNED_IN_HOLE)
    );
    
    return guardsInHole.some(guard => guard.isEntityOnTop(this.player.sprite));
  }
  
  /**
   * Check if player would be standing on guards in a hole below
   * Used by HoleSystem for Rule 8 platform mechanics
   */
  public wouldPlayerBeOnGuardInHole(belowHoleKey: string): boolean {
    const guardsInBelowHole = this.guards.filter(guard => 
      guard.getCurrentHole() === belowHoleKey && 
      (guard.getState() === GuardState.IN_HOLE || guard.getState() === GuardState.STUNNED_IN_HOLE)
    );
    
    return guardsInBelowHole.some(guard => {
      // Check if player's bottom aligns with guard's platform area
      const playerBottom = this.player.sprite.getBounds().bottom;
      const guardPlatform = guard.getPlatformBounds();
      return guardPlatform && guardPlatform.y <= playerBottom + 8; // Platform tolerance
    });
  }
  
  /**
   * Check if player is trapped in a filling hole
   * Used by HoleSystem before hole fills
   */
  public checkPlayerTrappedInHole(gridX: number, gridY: number): void {
    // Check if player is in the same grid position as the hole that's about to fill
    const playerX = Math.floor(this.player.sprite.x / GAME_CONFIG.tileSize);
    const playerY = Math.floor(this.player.sprite.y / GAME_CONFIG.tileSize);
    
    if (playerX === gridX && playerY === gridY) {
      // Player is trapped in the hole that's filling - kill player
      GameLogger.debug(`Player trapped in filling hole at (${gridX}, ${gridY}) - triggering death`);
      this.handlePlayerDeath();
    }
  }
  
  /**
   * Check if guards can escape before hole fills
   * Used by HoleSystem before hole fills
   */
  public checkGuardEscapeBeforeHoleFills(holeKey: string): void {
    GameLogger.debug(`[ESCAPE DEBUG] Checking guards in hole ${holeKey} before it fills`);
    
    // Get the timeline data for this hole
    
    // Find guards in this specific hole that are NOT already dying
    const guardsInHole = this.guards.filter(guard => {
      return guard.getCurrentHole() === holeKey && 
             guard.getState() !== GuardState.REBORN; // Don't kill guards already dying
    });
    
    // Process each guard in the hole
    guardsInHole.forEach(guard => {
      const shouldDie = this.holeSystem.getHoleTimeline().shouldGuardDie(holeKey, guard.getGuardId(), GAME_MECHANICS.GUARD_STUN_DURATION);
      
      if (shouldDie) {
        GameLogger.debug(`[ESCAPE] Guard ${guard.getGuardId()} cannot escape - executing death`);
        guard.executeTimelineBasedDeath();
      } else {
        GameLogger.debug(`[ESCAPE] Guard ${guard.getGuardId()} can escape - allowing climb out`);
        guard.attemptHoleEscape();
      }
    });
  }
  
}