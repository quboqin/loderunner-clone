import { Scene } from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '@/config/GameConfig';
import { GameState, HoleData } from '@/types/GameTypes';
import { SoundManager } from '@/managers/SoundManager';
import { AssetManager } from '@/managers/AssetManager';
import { InputManager } from '@/managers/InputManager';
import { Guard, GuardState } from '@/entities/Guard';
import { Player } from '@/entities/Player';
import { GameLogger, LevelLogger, GuardLogger, PhysicsLogger } from '@/utils/Logger';

export class GameScene extends Scene {
  private gameState!: GameState;
  private player!: Player;
  private inputManager!: InputManager;
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;
  private goldText!: Phaser.GameObjects.Text;
  private soundManager!: SoundManager;
  private solidTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ladderTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ropeTiles!: Phaser.Physics.Arcade.StaticGroup;
  private goldSprites!: Phaser.Physics.Arcade.StaticGroup;
  private exitLadderPosition: {x: number, y: number} | null = null;
  private allSPositions: {x: number, y: number}[] = [];
  private exitLadderSprites: Phaser.GameObjects.Sprite[] = [];
  private holes!: Map<string, HoleData>;
  private levelTiles!: Map<string, Phaser.GameObjects.Sprite>;
  private guards: Guard[] = [];
  private playerInvincible: boolean = false;
  private invincibilityEndTime: number = 0;
  
  // Debug visuals - simple on/off system
  private debugMode = false;
  private debugGraphics!: Phaser.GameObjects.Graphics;
  private debugText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  create(): void {
    
    
    this.initializeGameState();
    this.initializeAudio();
    this.setupInput(); // Initialize InputManager before creating Player
    this.createCollisionGroups();
    this.createLevel();
    this.createPlayer();
    this.createGuards(); // Create guards after player
    this.createUI();
    this.setupCollisions();
    this.initializeDebug();
    
    // Add brief invincibility when level starts (after death)
    this.addStartupInvincibility();
    
  }

  private initializeAudio(): void {
    this.soundManager = SoundManager.getInstance(this);
    this.soundManager.initializeSounds();
  }

  private initializeDebug(): void {
    // Create debug graphics for visual overlays
    this.debugGraphics = this.add.graphics();
    this.debugGraphics.setDepth(1000); // Render on top of everything
    
    // Create debug text display
    this.debugText = this.add.text(10, 100, '', {
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

  private createCollisionGroups(): void {
    // Set world bounds to prevent entities from escaping game world
    // Level is 28 tiles wide x 16 tiles high, each tile is 32 pixels
    // Entity positions use UNSCALED coordinates (sprites are scaled visually only)
    const levelWidth = 28 * 32; // 896 pixels (unscaled)
    const levelHeight = 16 * 32; // 512 pixels (unscaled)
    this.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    
    PhysicsLogger.debug(`World bounds set: ${levelWidth}x${levelHeight} pixels (unscaled coordinates)`);
    
    // Create static groups for different tile types
    this.solidTiles = this.physics.add.staticGroup();
    this.ladderTiles = this.physics.add.staticGroup();
    this.ropeTiles = this.physics.add.staticGroup();
    this.goldSprites = this.physics.add.staticGroup();
    
    // Initialize hole management system
    this.holes = new Map<string, HoleData>();
    this.levelTiles = new Map<string, Phaser.GameObjects.Sprite>();
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
    
    GameLogger.debug(`Game state initialized - Level: ${preservedLevel}, Lives: ${preservedLives}, Score: ${preservedScore}`);
    
    // Initialize invincibility state
    this.playerInvincible = false;
    this.invincibilityEndTime = 0;
  }

  private createLevel(): void {
    this.cameras.main.setBackgroundColor('#000000');
    
    // Load level data from classic levels
    const levelsData = this.cache.json.get('classic-levels');
    const levelKey = `level-${this.gameState.currentLevel.toString().padStart(3, '0')}`;
    LevelLogger.debug(`Loading level key: ${levelKey}`);
    let currentLevelData = levelsData.levels[levelKey];
    
    // If level doesn't exist, fallback to level 1
    if (!currentLevelData) {
      this.gameState.currentLevel = 1;
      currentLevelData = levelsData.levels['level-001'];
    }
    
    // Parse level data using AssetManager
    const levelInfo = AssetManager.parseLevelData(currentLevelData);
    
    // Store exit ladder position and all S positions
    this.exitLadderPosition = levelInfo.exitLadder;
    this.allSPositions = levelInfo.allSPositions;
    
    // Create tilemap from parsed data
    this.createTilemap(levelInfo.tiles);
    
    // Set player starting position
    this.registry.set('playerStart', levelInfo.playerStart);
    
    // Create gold objects
    levelInfo.gold.forEach((goldPos: { x: number; y: number }) => {
      const gold = this.add.sprite(goldPos.x + 16, goldPos.y + 16, 'tiles', 'gold');
      gold.setScale(1.6); // Keep scaling for gold to match tile size
      gold.setData('type', 'gold');
      gold.setDepth(200); // Ensure gold renders above background elements
      
      // Add physics body for collision detection
      this.physics.add.existing(gold, true); // true = static body
      this.goldSprites.add(gold);
      
      this.gameState.totalGold++;
    });
    
  }

  private createTilemap(tiles: number[][]): void {
    tiles.forEach((row, y) => {
      row.forEach((tileType, x) => {
        if (tileType !== 0) { // Skip empty tiles
          const pixelX = x * GAME_CONFIG.tileSize;
          const pixelY = y * GAME_CONFIG.tileSize;
          
          const frameKey = AssetManager.getTileFrame(tileType);
          const tile = this.add.sprite(pixelX + 16, pixelY + 16, 'tiles', frameKey);
          tile.setScale(1.6); // Keep scaling for tiles to maintain proper level size
          tile.setData('tileType', tileType);
          tile.setData('gridX', x);
          tile.setData('gridY', y);
          
          // Store tile reference for hole digging
          const tileKey = `${x},${y}`;
          this.levelTiles.set(tileKey, tile);
          
          // Add collision bodies based on tile type
          this.addTileCollision(tile, tileType);
        }
      });
    });
  }


  private addTileCollision(tile: Phaser.GameObjects.Sprite, tileType: number): void {
    // Add collision bodies for different tile types
    switch (tileType) {
      case 1: // Brick - solid collision, can be dug
      case 2: // Solid - solid collision, cannot be dug
      case 5: // Solid block (@) - solid collision, cannot be dug
        this.physics.add.existing(tile, true); // true = static body
        this.solidTiles.add(tile);
        tile.setDepth(10); // Standard tile depth
        break;
      
      case 3: // Ladder - climbable with platform-style collision (solid from top)
        this.physics.add.existing(tile, true);
        this.ladderTiles.add(tile);
        // Also add to solid tiles for top collision support
        this.solidTiles.add(tile);
        tile.setDepth(100); // Higher depth to render above holes
        break;
        
      case 4: // Rope - climbable, no solid collision
        this.physics.add.existing(tile, true);
        this.ropeTiles.add(tile);
        tile.setDepth(100); // Higher depth to render above holes
        break;
        
    }
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
    
    // Load level data to get guard positions
    const levelsData = this.cache.json.get('classic-levels');
    const levelKey = `level-${this.gameState.currentLevel.toString().padStart(3, '0')}`;
    LevelLogger.debug(`Loading level: ${levelKey}`);
    let currentLevelData = levelsData.levels[levelKey];
    
    // If level doesn't exist, fallback to level 1
    if (!currentLevelData) {
      LevelLogger.warn(`Level ${levelKey} not found, falling back to level-001`);
      currentLevelData = levelsData.levels['level-001'];
    }
    
    // Parse level data using AssetManager
    const levelInfo = AssetManager.parseLevelData(currentLevelData);
    
    // Create guard AI entities
    GuardLogger.debug(`Creating ${levelInfo.guards.length} guards for level ${levelKey}`);
    levelInfo.guards.forEach((guardPos: { x: number; y: number }, index: number) => {
      GuardLogger.debug(`Creating guard ${index} at position (${guardPos.x + 16}, ${guardPos.y + 16})`);
      const guard = new Guard(this, guardPos.x + 16, guardPos.y + 16, this.player.sprite);
      guard.setCollisionCallbacks(this.ladderTiles, this.ropeTiles, this.solidTiles);
      this.guards.push(guard);
    });
    
    // Set up guard-to-guard collision detection to prevent overlapping
    this.setupGuardToGuardCollisions();
    
    GuardLogger.debug(`Total guards created: ${this.guards.length}`);
  }

  private setupGuardToGuardCollisions(): void {
    // Set up collision between each pair of guards to prevent overlapping
    for (let i = 0; i < this.guards.length; i++) {
      for (let j = i + 1; j < this.guards.length; j++) {
        const guardA = this.guards[i];
        const guardB = this.guards[j];
        
        // Add collision between the two guards
        this.physics.add.collider(guardA.sprite, guardB.sprite, () => {
          // When guards collide, make them bounce slightly and change direction
          this.handleGuardToGuardCollision(guardA, guardB);
        });
      }
    }
    
    GuardLogger.debug(`Set up ${this.guards.length * (this.guards.length - 1) / 2} guard-to-guard collision pairs`);
  }

  private handleGuardToGuardCollision(guardA: Guard, guardB: Guard): void {
    // Prevent guards from getting stuck by making them change direction when they collide
    const guardAState = guardA.getState();
    const guardBState = guardB.getState();
    
    // Only handle collision if both guards are in moveable states
    if (guardAState !== GuardState.IN_HOLE && guardAState !== GuardState.REBORN &&
        guardBState !== GuardState.IN_HOLE && guardBState !== GuardState.REBORN) {
      
      // Calculate positions to determine who should go which way
      const guardAX = guardA.sprite.x;
      const guardBX = guardB.sprite.x;
      
      // Make the leftmost guard go left, rightmost guard go right
      if (guardAX < guardBX) {
        // Guard A is on the left, make it go left; Guard B go right
        this.bounceGuard(guardA, -1); // Go left
        this.bounceGuard(guardB, 1);  // Go right
      } else {
        // Guard B is on the left, make it go left; Guard A go right  
        this.bounceGuard(guardB, -1); // Go left
        this.bounceGuard(guardA, 1);  // Go right
      }
    }
  }

  private bounceGuard(guard: Guard, direction: number): void {
    // Give guard a small velocity push in the specified direction
    const body = guard.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(direction * 50); // Small bounce velocity
    
    // Force the guard to change direction using the public method
    guard.forceDirection(direction);
  }

  private setupCollisions(): void {
    // Player collides with solid tiles (walls, floors, bricks, and ladder tops)
    this.physics.add.collider(this.player.sprite, this.solidTiles, undefined, (player: any, tile: any) => {
      const playerBody = player.body as Phaser.Physics.Arcade.Body;
      const tileData = tile.getData('tileType');
      
      // Special handling for ladders - only collide from above (platform behavior)
      if (tileData === 3) { // Ladder tile
        // Allow collision only if player is falling/moving down onto ladder top
        // Block collision if player is moving up through ladder from below
        const playerBottom = playerBody.y + playerBody.height;
        const tileTop = tile.body.y;
        const movingUp = playerBody.velocity.y < 0;
        
        // Get climbing state and movement input
        const climbingState = this.player.getClimbingState();
        const hasDownInput = this.inputManager.isDownPressed();
        
        // If player is moving up, always allow pass-through
        if (movingUp) {
          return false; // Allow pass-through when moving up through ladder
        }
        
        // If player is pressing down (wants to climb down), allow pass-through
        // This handles both cases: climbing down while on ladder, and entering ladder from above
        if (hasDownInput) {
          return false; // Allow pass-through when intentionally moving down
        }
        
        // If player is already climbing, allow pass-through to prevent getting stuck
        if (climbingState.onLadder) {
          return false; // Allow pass-through when in climbing state
        }
        
        // Only collide if player is coming from above (normal falling onto ladder top)
        return playerBottom <= tileTop + 5; // Small tolerance for platform collision
      }
      
      return true; // Normal collision for non-ladder tiles
    }, this);
    
    // Player collision with gold - automatic collection
    this.physics.add.overlap(this.player.sprite, this.goldSprites, (_player: any, gold: any) => {
      this.collectGold(gold as Phaser.GameObjects.Sprite);
    }, undefined, this);
    
    // Note: Ladder and rope detection now handled by position-based continuous detection
    // in updateClimbableState() method - no overlap handlers needed
  }

  private createUI(): void {
    const padding = 20;
    
    this.scoreText = this.add.text(padding, GAME_CONFIG.height - padding - 90, `SCORE: ${this.gameState.score}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.levelText = this.add.text(padding, GAME_CONFIG.height - padding - 60, `LEVEL: ${this.gameState.currentLevel}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.livesText = this.add.text(padding, GAME_CONFIG.height - padding - 30, `LIVES: ${this.gameState.lives}`, {
      fontSize: '24px',
      color: '#FFFF00',
      fontFamily: 'Arial, sans-serif'
    }).setDepth(2000);

    this.goldText = this.add.text(GAME_CONFIG.width - padding, padding, 
      `GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`, {
      fontSize: '24px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0).setDepth(2000);

    this.add.text(GAME_CONFIG.width - padding, GAME_CONFIG.height - padding - 60, 
      'ESC - Menu', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);

    this.add.text(GAME_CONFIG.width - padding, GAME_CONFIG.height - padding - 30, 
      'Arrow Keys - Move', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);
  }

  private setupInput(): void {
    // Initialize InputManager for centralized input handling
    this.inputManager = new InputManager(this);
  }

  private updateCounter = 0;

  update(time: number, delta: number): void {
    try {
      this.updateCounter++;
      
      // Handle input through InputManager
      this.handleInput();
      
      // Update Player entity
      this.player.update(time, delta);
      
      this.updateUI();
      this.updatePlayerState();
      this.updateGuards(time, delta);
      this.checkGuardPlayerCollisions();
      
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
      this.digHole('left');
    }

    if (this.inputManager.isDigRightPressed()) {
      this.player.digRight();
      this.digHole('right');
    }

    // Handle debug toggle
    if (this.inputManager.isDebugTogglePressed()) {
      this.toggleDebugMode();
    }
  }

  private updatePlayerState(): void {
    // Check ladder/rope state using continuous position-based detection
    this.updateClimbableState();
    
    // Check for holes player might fall through
    this.checkHoleCollisions();
    
    // Check for exit ladder completion
    this.checkExitLadderCompletion();
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
      this.ladderTiles.children.entries.forEach((tile: any) => {
        // Account for tile positioning: tiles are positioned at center (pixelX + 16, pixelY + 16)
        // So to get tile grid coordinates, we need to subtract 16 before dividing
        const tileTileX = Math.floor((tile.x - 16) / GAME_CONFIG.tileSize);
        const tileTileY = Math.floor((tile.y - 16) / GAME_CONFIG.tileSize);
        
        
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
    
    // Don't detect rope if player is jumping from rope
    const jumpingFromRope = false;
    if (!jumpingFromRope) {
      this.ropeTiles.children.entries.forEach((tile: any) => {
        // Account for tile positioning: tiles are positioned at center (pixelX + 16, pixelY + 16)
        const tileTileX = Math.floor((tile.x - 16) / GAME_CONFIG.tileSize);
        const tileTileY = Math.floor((tile.y - 16) / GAME_CONFIG.tileSize);
        
        // Check if player center is at the same tile position as rope
        // This ensures consistent detection during horizontal movement
        if (tileTileX === playerTileX && tileTileY === playerTileY) {
          onRope = true;
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
    
    // Update player data
    this.player.setClimbableState(onLadder, onRope);
    
    // Initialize rope Y lock when first touching rope
    // TODO: Fix rope detection - currently handled in Player entity
    // TODO: Handle wasOnRope state in Player entity
  }
  

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.gameState.score}`);
    this.levelText.setText(`LEVEL: ${this.gameState.currentLevel}`);
    this.livesText.setText(`LIVES: ${this.gameState.lives}`);
    this.goldText.setText(`GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`);
  }


  private collectGold(goldSprite: Phaser.GameObjects.Sprite): void {
    // Delegate gold collection sound to Player
    this.player.collectGold();
    
    // Update game state
    this.gameState.goldCollected++;
    this.gameState.score += 100;
    
    // Remove gold from collision group first to prevent multiple collections
    this.goldSprites.remove(goldSprite);
    
    // Add collection animation - scale up and fade out
    this.tweens.add({
      targets: goldSprite,
      scaleX: goldSprite.scaleX * 1.5,
      scaleY: goldSprite.scaleY * 1.5,
      alpha: 0,
      duration: 200,
      ease: 'Power2',
      onComplete: () => {
        goldSprite.destroy();
      }
    });
    
    // Show score popup
    const scoreText = this.add.text(goldSprite.x, goldSprite.y - 20, '+100', {
      fontSize: '18px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5, 0.5).setDepth(300);
    
    // Animate score popup
    this.tweens.add({
      targets: scoreText,
      y: scoreText.y - 30,
      alpha: 0,
      duration: 800,
      ease: 'Power2',
      onComplete: () => {
        scoreText.destroy();
      }
    });
    
    // Check if all gold is collected
    if (this.gameState.goldCollected >= this.gameState.totalGold) {
      this.revealExitLadder();
    }
  }

  private revealExitLadder(): void {
    if (this.allSPositions.length === 0) {
      return; // No S ladders in this level
    }

    // Create ladder sprites for all S positions
    this.allSPositions.forEach((position, index) => {
      const ladder = this.add.sprite(
        position.x + 16, 
        position.y + 16, 
        'tiles', 
        'ladder'
      );
      ladder.setScale(1.6);
      ladder.setDepth(100);
      ladder.setAlpha(0); // Start invisible
      
      // Calculate grid coordinates first
      const gridX = position.x / 32;
      const gridY = position.y / 32;
      const tileKey = `${gridX},${gridY}`;
      
      // Set tile data so collision detection recognizes this as a ladder
      ladder.setData('tileType', 3); // Type 3 = ladder
      ladder.setData('gridX', gridX);
      ladder.setData('gridY', gridY);
      
      // Add physics for ladder collision detection (same as regular ladders)
      this.physics.add.existing(ladder, true);
      this.ladderTiles.add(ladder);
      this.solidTiles.add(ladder); // Needed for platform-style collision from above
      
      // Store reference to the created sprites
      this.exitLadderSprites.push(ladder);
      
      // Store in level tiles for consistency
      this.levelTiles.set(tileKey, ladder);
      
      // Fade in animation with staggered timing
      this.tweens.add({
        targets: ladder,
        alpha: 1,
        duration: 1000,
        delay: index * 200, // Stagger the animations
        ease: 'Power2'
      });
    });

    // Play special sound effect
    this.soundManager.playSFX('pass'); // Using existing 'pass' sound
    
    // Show message
    const message = this.add.text(this.cameras.main.centerX, this.cameras.main.centerY - 100, 
      'EXIT LADDER REVEALED!', {
      fontSize: '32px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5, 0.5).setDepth(400);
    
    // Animate message
    this.tweens.add({
      targets: message,
      y: message.y - 50,
      alpha: 0,
      duration: 2000,
      ease: 'Power2',
      onComplete: () => {
        message.destroy();
      }
    });
  }

  private digHole(direction: 'left' | 'right'): void {
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    const playerGridX = Math.floor(this.player.sprite.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(this.player.sprite.y / GAME_CONFIG.tileSize);
    
    // Calculate target hole position based on direction
    let targetX = playerGridX + (direction === 'left' ? -1 : 1);
    let targetY = playerGridY + 1; // Dig one tile below and to the side
    
    // Check if player is on solid ground (can't dig while falling)  
    const climbingState = this.player.getClimbingState();
    if (!playerBody.onFloor() && !climbingState.onLadder) {
      return; // Can't dig while in mid-air
    }
    
    // Check if target position is valid and diggable
    if (!this.canDigAtPosition(targetX, targetY)) {
      return; // Can't dig here
    }
    
    // Play digging sound
    this.soundManager.playSFX('dig');
    
    // Create the hole
    this.createHole(targetX, targetY, direction);
    
    // Play player digging animation
    const digAnimationKey = direction === 'left' ? 'hole-dig-left' : 'hole-dig-right';
    this.player.sprite.play(digAnimationKey);
    
    // Return to idle animation after digging
    this.time.delayedCall(500, () => {
      if (this.player.sprite.anims.currentAnim?.key.includes('hole-dig')) {
        this.player.sprite.play('player-idle');
      }
    });
  }

  private canDigAtPosition(gridX: number, gridY: number): boolean {
    // Check bounds
    if (gridX < 0 || gridX >= 28 || gridY < 0 || gridY >= 16) {
      return false;
    }
    
    // Allow digging holes on bottom row - we'll handle the floor collision separately
    
    // Check if there's already a hole here
    const holeKey = `${gridX},${gridY}`;
    if (this.holes.has(holeKey)) {
      return false;
    }
    
    // Check if there's a diggable tile at this position
    const tileKey = `${gridX},${gridY}`;
    const tile = this.levelTiles.get(tileKey);
    
    if (!tile) {
      return false; // No tile to dig
    }
    
    const tileType = tile.getData('tileType');
    
    // Only brick tiles (type 1) can be dug
    // Solid blocks (type 2 and type 5) cannot be dug
    return tileType === 1;
  }

  private createHole(gridX: number, gridY: number, direction: 'left' | 'right'): void {
    const pixelX = gridX * GAME_CONFIG.tileSize + 16;
    const pixelY = gridY * GAME_CONFIG.tileSize + 16;
    
    // Get the original tile
    const tileKey = `${gridX},${gridY}`;
    const originalTile = this.levelTiles.get(tileKey);
    
    if (!originalTile) {
      return;
    }
    
    // CRITICAL FIX: Save tile data BEFORE destroying the tile
    const originalTileType = originalTile.getData('tileType');
    
    // In classic Lode Runner, when digging a hole, we need to preserve any
    // non-diggable background elements (ropes, ladders) that exist at this position
    // These should remain visible and functional even with a hole above them
    
    // Create hole sprite
    const holeSprite = this.add.sprite(pixelX, pixelY, 'hole', 0);
    holeSprite.setScale(1.6);
    holeSprite.setDepth(50); // Low depth to avoid covering ropes/ladders
    holeSprite.setAlpha(1); // Ensure full opacity for proper rendering
    holeSprite.setBlendMode(Phaser.BlendModes.NORMAL); // Use normal blending mode
    
    // Play digging animation
    const digAnimationKey = direction === 'left' ? 'hole-dig-left' : 'hole-dig-right';
    
    try {
      holeSprite.play(digAnimationKey);
    } catch (error) {
      // Fallback - set a static frame that represents an open hole
      holeSprite.setFrame(7); // Final dig frame - should be transparent hole
    }
    
    // Ensure hole sprite doesn't have black background issues
    holeSprite.setTint(0xffffff); // Neutral white tint to prevent color issues
    
    // Remove original tile from collision groups
    this.removeFromCollisionGroups(originalTile);
    
    // Completely destroy the original tile to prevent visual artifacts
    originalTile.destroy();
    
    // Set up regeneration timer (3 seconds)
    const regenerationTimer = this.time.delayedCall(3000, () => {
      // Verify hole still exists before filling
      const currentHoleKey = `${gridX},${gridY}`;
      if (this.holes.has(currentHoleKey)) {
        this.fillHole(gridX, gridY);
      }
    }, undefined, this); // Use 'this' as context
    
    // Store hole data using the saved tile type
    const holeData: HoleData = {
      gridX,
      gridY,
      sprite: holeSprite,
      originalTileType: originalTileType, // Use saved value instead of accessing destroyed tile
      regenerationTimer,
      isDigging: true
    };
    
    const holeKey = `${gridX},${gridY}`;
    this.holes.set(holeKey, holeData);
    
    // After digging animation completes, set isDigging to false
    holeSprite.once('animationcomplete', (animation: any) => {
      if (animation.key && animation.key.includes('hole-dig')) {
        holeData.isDigging = false;
      }
    });
  }

  private removeFromCollisionGroups(tile: Phaser.GameObjects.Sprite): void {
    // Remove from solid tiles group
    if (this.solidTiles.children.entries.includes(tile)) {
      this.solidTiles.remove(tile);
    }
    
    // Remove from ladder tiles group
    if (this.ladderTiles.children.entries.includes(tile)) {
      this.ladderTiles.remove(tile);
    }
    
    // Remove physics body
    if (tile.body && (tile.body instanceof Phaser.Physics.Arcade.Body || tile.body instanceof Phaser.Physics.Arcade.StaticBody)) {
      this.physics.world.remove(tile.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody);
    }
  }

  private fillHole(gridX: number, gridY: number): void {
    const holeKey = `${gridX},${gridY}`;
    const holeData = this.holes.get(holeKey);
    
    if (!holeData) {
      return;
    }
    
    // Check if any guards can escape before hole fills
    this.checkGuardEscapeBeforeHoleFills(holeKey);
    
    try {
      holeData.sprite.play('hole-fill');
      
      // Set up one-time event listener for animation completion
      holeData.sprite.once('animationcomplete', (animation: any) => {
        if (animation.key === 'hole-fill') {
          this.restoreOriginalTile(holeData, holeKey);
        }
      });
      
      // Fallback timeout in case animation takes too long or fails
      this.time.delayedCall(2000, () => {
        if (this.holes.has(holeKey)) {
          this.restoreOriginalTile(holeData, holeKey);
        }
      });
      
    } catch (error) {
      // Fallback - directly restore tile after short delay
      this.time.delayedCall(1000, () => {
        this.restoreOriginalTile(holeData, holeKey);
      });
    }
  }
  
  private restoreOriginalTile(holeData: HoleData, holeKey: string): void {
    // Instead of hiding/showing, recreate the tile completely
    const pixelX = holeData.gridX * GAME_CONFIG.tileSize + 16;
    const pixelY = holeData.gridY * GAME_CONFIG.tileSize + 16;
    
    // Clean up hole sprite first
    holeData.sprite.destroy();
    
    // Get the original tile frame
    const frameKey = AssetManager.getTileFrame(holeData.originalTileType);
    
    // Create new tile sprite
    const newTile = this.add.sprite(pixelX, pixelY, 'tiles', frameKey);
    newTile.setScale(1.6);
    newTile.setData('tileType', holeData.originalTileType);
    newTile.setData('gridX', holeData.gridX);
    newTile.setData('gridY', holeData.gridY);
    
    // Update tile reference in levelTiles map
    const tileKey = `${holeData.gridX},${holeData.gridY}`;
    this.levelTiles.set(tileKey, newTile);
    
    // Add to collision groups
    this.addTileCollision(newTile, holeData.originalTileType);
    
    // Remove hole data
    this.holes.delete(holeKey);
  }

  private checkHoleCollisions(): void {
    const playerGridX = Math.floor(this.player.sprite.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(this.player.sprite.y / GAME_CONFIG.tileSize);
    const playerBody = this.player.sprite.body as Phaser.Physics.Arcade.Body;
    
    // Check if player is near or on any hole for rendering priority
    let nearHole = false;
    
    // Check player's current position and adjacent positions for holes
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const checkKey = `${playerGridX + dx},${playerGridY + dy}`;
        if (this.holes.has(checkKey)) {
          nearHole = true;
          break;
        }
      }
      if (nearHole) break;
    }
    
    // Boost player depth when near holes to ensure proper rendering
    if (nearHole) {
      this.player.sprite.setDepth(1100); // Extra boost when near holes
    } else {
      this.player.sprite.setDepth(1000); // Normal depth
    }
    
    // Check if player is standing on a hole
    const holeKey = `${playerGridX},${playerGridY}`;
    const hole = this.holes.get(holeKey);
    
    if (hole && !hole.isDigging) {
      // Player is on a hole and not in digging animation - make them fall
      const climbingState = this.player.getClimbingState();
      if (!climbingState.onLadder && !climbingState.onRope) {
        // Enable gravity to make player fall through the hole
        if (playerBody.gravity.y === 0) {
          playerBody.setGravityY(800);
        }
        playerBody.moves = true;
      }
    }
    
    // Also check the tile directly below the player for holes
    const belowHoleKey = `${playerGridX},${playerGridY + 1}`;
    const belowHole = this.holes.get(belowHoleKey);
    
    if (belowHole && !belowHole.isDigging) {
      // There's a hole below the player - they should fall through
      const climbingState = this.player.getClimbingState();
      if (!climbingState.onLadder && !climbingState.onRope) {
        // Check if player is close enough to the hole to fall through
        const playerBottom = playerBody.y + playerBody.height;
        const holeTop = belowHole.sprite.y - (belowHole.sprite.displayHeight / 2);
        
        if (playerBottom >= holeTop - 5) {
          // Player is above or in the hole - make them fall
          if (playerBody.gravity.y === 0) {
            playerBody.setGravityY(800);
          }
          playerBody.moves = true;
        }
      }
    }
  }

  private checkExitLadderCompletion(): void {
    // Debug logging
    if (this.gameState.goldCollected >= this.gameState.totalGold) {
      GameLogger.debug(`Level completion check: ExitSprites: ${this.exitLadderSprites.length}, FirstVisible: ${this.exitLadderSprites[0]?.visible}, GoldCollected: ${this.gameState.goldCollected}/${this.gameState.totalGold}`);
    }
    
    // Only check if exit ladder sprites exist and are visible (all gold collected)
    if (this.exitLadderSprites.length === 0 || !this.exitLadderSprites[0].visible) {
      return;
    }

    // Only check completion for the designated exit ladder position
    if (!this.exitLadderPosition) {
      return;
    }

    // Check if player is at the top of the designated exit ladder
    const playerCenterX = this.player.sprite.x;
    const playerCenterY = this.player.sprite.y;
    const playerTileX = Math.floor(playerCenterX / GAME_CONFIG.tileSize);
    const playerTileY = Math.floor(playerCenterY / GAME_CONFIG.tileSize);
    
    // Get exit ladder position
    const exitLadderTileX = this.exitLadderPosition.x / GAME_CONFIG.tileSize;
    const exitLadderTileY = this.exitLadderPosition.y / GAME_CONFIG.tileSize;
    
    // Check if player is on the exit ladder tile
    if (playerTileX === exitLadderTileX && playerTileY === exitLadderTileY) {
      // Check if player is at the top of the ladder (within the upper portion of the tile)
      const ladderPixelY = exitLadderTileY * GAME_CONFIG.tileSize;
      const ladderTopThreshold = ladderPixelY + (GAME_CONFIG.tileSize * 0.8); // Top 80% of ladder tile (more lenient)
      
      GameLogger.debug(`Level completion check: On exit ladder! PlayerY: ${playerCenterY}, Threshold: ${ladderTopThreshold}`);
      
      if (playerCenterY <= ladderTopThreshold) {
        LevelLogger.info('Level completed successfully!');
        // Player reached the top of the exit ladder - complete level!
        this.completeLevel();
      }
    }
  }

  private completeLevel(): void {
    // Play level completion music
    this.soundManager.playLevelComplete();
    
    // Add level completion bonus
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

    // Transition to next level or game complete after delay
    this.time.delayedCall(3000, () => {
      completeText.destroy();
      this.loadNextLevel();
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
    
    // Restart scene with new level
    this.scene.restart();
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
      '=== VISUAL LEGEND ===',
      'RED: Sprite bounds (visual)',
      'BLUE: Collision body (physics)',
      'GREEN: Tile grid (32x32)',
      'YELLOW: Sprite center',
      'ORANGE: Body center'
    ];
    
    this.debugText.setText(debugInfo.join('\n'));
  }

  private updateGuards(time: number, delta: number): void {
    this.guards.forEach(guard => {
      guard.update(time, delta);
      this.checkGuardHoleCollisions(guard);
      this.updateGuardClimbableState(guard);
    });
  }
  
  private checkGuardHoleCollisions(guard: Guard): void {
    const guardX = Math.floor(guard.sprite.x / 32);
    const guardY = Math.floor(guard.sprite.y / 32);
    const holeKey = `${guardX},${guardY}`;
    
    // Check if guard is at a hole position
    if (this.holes.has(holeKey)) {
      const holeData = this.holes.get(holeKey)!;
      if (holeData.sprite && holeData.sprite.visible) {
        
        // Only trap guard if they are falling into the hole or moving slowly
        const guardBody = guard.sprite.body as Phaser.Physics.Arcade.Body;
        const isMovingHorizontally = Math.abs(guardBody.velocity.x) > 50; // Moving fast horizontally
        const isFalling = guardBody.velocity.y > 0; // Falling down
        const isOnGround = guardBody.blocked.down || guardBody.touching.down;
        
        // Guards should be aggressive and chase player even through holes
        // Only trap if they're really falling in (not actively chasing)
        const isActivelyChasing = Math.abs(guardBody.velocity.x) > 30; // Moving with purpose
        const isSlowlyFalling = isFalling && Math.abs(guardBody.velocity.y) < 100; // Slow fall, not fast drop
        
        if (!isActivelyChasing && (isSlowlyFalling || (isOnGround && !isMovingHorizontally))) {
          // Special handling for bottom-layer holes - shorter trap time
          if (holeData.gridY >= 15) {
            GuardLogger.debug('Guard trapped in bottom hole - will respawn quickly');
          }
          guard.fallIntoHole(holeKey);
        }
        // Guard is actively chasing - let them pass through or jump over
      }
    }
  }

  private checkGuardPlayerCollisions(): void {
    // Check for more robust invincibility system
    const currentTime = this.time.now;
    if (this.playerInvincible && currentTime < this.invincibilityEndTime) {
      return; // Player is invincible
    } else if (this.playerInvincible && currentTime >= this.invincibilityEndTime) {
      // End invincibility period
      this.playerInvincible = false;
      this.player.sprite.setAlpha(1.0);
    }
    
    for (const guard of this.guards) {
      if (guard.checkPlayerCollision(this.player.sprite)) {
        this.handlePlayerDeath();
        break; // Only one collision needed
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

  private checkGuardEscapeBeforeHoleFills(holeKey: string): void {
    GuardLogger.debug(`Checking if guards can escape from hole ${holeKey} before it fills`);
    
    // Find guards in this specific hole
    const guardsInHole = this.guards.filter(guard => guard.getCurrentHole() === holeKey);
    
    if (guardsInHole.length > 0) {
      GuardLogger.debug(`Found ${guardsInHole.length} guard(s) in hole ${holeKey}`);
      
      guardsInHole.forEach((guard, index) => {
        const canEscape = guard.attemptHoleEscape();
        if (canEscape) {
          GuardLogger.debug(`Guard ${index} escaped from hole ${holeKey}`);
        } else {
          GuardLogger.debug(`Guard ${index} trapped in hole ${holeKey} - will respawn`);
        }
      });
    }
  }

  private updateGuardClimbableState(guard: Guard): void {
    // Reset climbable flags each frame
    guard.setClimbableState(false, false);
    
    // Check if guard is overlapping with ladders
    const ladderOverlap = this.physics.overlap(guard.sprite, this.ladderTiles);
    if (ladderOverlap) {
      guard.setClimbableState(true, false);
    }
    
    // Check if guard is overlapping with ropes
    const ropeOverlap = this.physics.overlap(guard.sprite, this.ropeTiles);
    if (ropeOverlap) {
      guard.setClimbableState(guard.canClimb(), true);
    }
  }

  destroy(): void {
    // Clean up all active holes and their timers
    if (this.holes) {
      this.holes.forEach((holeData) => {
        if (holeData.regenerationTimer) {
          holeData.regenerationTimer.destroy();
        }
        if (holeData.sprite) {
          holeData.sprite.destroy();
        }
      });
      
      this.holes.clear();
    }
    
    // Clean up guards
    if (this.guards) {
      this.guards.forEach(guard => {
        guard.destroy();
      });
      this.guards = [];
    }
    
    if (this.levelTiles) {
      this.levelTiles.clear();
    }
  }
}