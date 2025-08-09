import { Scene } from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '@/config/GameConfig';
import { GameState, HoleData } from '@/types/GameTypes';
import { SoundManager } from '@/managers/SoundManager';
import { AssetManager } from '@/managers/AssetManager';

export class GameScene extends Scene {
  private gameState!: GameState;
  private player!: Phaser.GameObjects.Sprite;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
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
  private levelCompleted: boolean = false;
  private holes!: Map<string, HoleData>;
  private levelTiles!: Map<string, Phaser.GameObjects.Sprite>;
  
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
    this.createCollisionGroups();
    this.createLevel();
    this.createPlayer();
    this.createUI();
    this.setupInput();
    this.setupCollisions();
    this.initializeDebug();
    
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
    this.gameState = {
      currentLevel: 1,
      score: 0,
      lives: 3,
      goldCollected: 0,
      totalGold: 0 // Will be set when level loads
    };
  }

  private createLevel(): void {
    this.cameras.main.setBackgroundColor('#000000');
    
    // Load level data from classic levels
    const levelsData = this.cache.json.get('classic-levels');
    const levelKey = `level-${this.gameState.currentLevel.toString().padStart(3, '0')}`;
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
    
    // Create guard starting positions (for later implementation)
    levelInfo.guards.forEach((guardPos: { x: number; y: number }) => {
      // Placeholder for guard spawning
      const guard = this.add.sprite(guardPos.x + 16, guardPos.y + 16, 'guard', 'guard_00');
      guard.setScale(1.6); // Restore scaling to match other sprites
      guard.setData('type', 'guard');
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
      case 1: // Brick - solid collision
      case 2: // Solid - solid collision  
      case 5: // Special brick - solid collision
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
    
    
    // Create player sprite using IBM runner atlas
    this.player = this.add.sprite(startPos.x, startPos.y, 'runner', 'runner_00');
    this.player.setScale(1.6); // Scale from 20x22 to ~32x32
    this.player.setDepth(1000); // Ensure player renders above all tiles and holes
    this.player.play('player-idle');
    
    this.physics.add.existing(this.player);
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    // With 1.6x scaling, sprite is ~32x35 display size  
    // Use smaller collision box to fit through single-tile gaps (32px tiles)
    // IMPORTANT: setSize() multiplies by sprite scale, so compensate for 1.6x scale
    const desiredBodyWidth = 16;
    const desiredBodyHeight = 28;
    const spriteScale = 1.6;
    playerBody.setSize(desiredBodyWidth / spriteScale, desiredBodyHeight / spriteScale);
    
    
    // IMPORTANT: setOffset() also multiplies by sprite scale, so compensate for 1.6x scale
    const desiredOffsetX = 8; // Center horizontally 
    const desiredOffsetY = 4; // Safe Y offset with minimal gap
    playerBody.setOffset(desiredOffsetX / spriteScale, desiredOffsetY / spriteScale);
    
    // CRITICAL FIX: Explicitly enable gravity for the player body
    // Individual bodies don't inherit global gravity automatically in Phaser
    playerBody.setGravityY(800); // Match the global gravity
    
    
  }

  private setupCollisions(): void {
    // Player collides with solid tiles (walls, floors, bricks, and ladder tops)
    this.physics.add.collider(this.player, this.solidTiles, undefined, (player: any, tile: any) => {
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
        const isClimbing = this.player.getData('onLadder');
        const hasDownInput = this.cursors.down.isDown || this.wasdKeys.S.isDown;
        
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
        if (isClimbing) {
          return false; // Allow pass-through when in climbing state
        }
        
        // Only collide if player is coming from above (normal falling onto ladder top)
        return playerBottom <= tileTop + 5; // Small tolerance for platform collision
      }
      
      return true; // Normal collision for non-ladder tiles
    }, this);
    
    // Player collision with gold - automatic collection
    this.physics.add.overlap(this.player, this.goldSprites, (_player: any, gold: any) => {
      this.collectGold(gold as Phaser.GameObjects.Sprite);
    }, undefined, this);
    
    // Note: Ladder and rope detection now handled by position-based continuous detection
    // in updateClimbableState() method - no overlap handlers needed
  }

  private createUI(): void {
    const padding = 20;
    
    this.scoreText = this.add.text(padding, padding, `SCORE: ${this.gameState.score}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.levelText = this.add.text(padding, padding + 30, `LEVEL: ${this.gameState.currentLevel}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.livesText = this.add.text(padding, padding + 60, `LIVES: ${this.gameState.lives}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.goldText = this.add.text(GAME_CONFIG.width - padding, padding, 
      `GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`, {
      fontSize: '24px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);

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
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D,Z,X') as { [key: string]: Phaser.Input.Keyboard.Key };

    // ESC key to return to menu
    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.MENU);
    });

    // Add digging controls
    this.input.keyboard!.on('keydown-Z', () => {
      this.digHole('left');
    });

    this.input.keyboard!.on('keydown-X', () => {
      this.digHole('right');
    });

    // Debug mode toggle (simple on/off)
    this.input.keyboard!.on('keydown-J', () => {
      this.toggleDebugMode();
    });
  }

  private updateCounter = 0;

  update(): void {
    try {
      this.updateCounter++;
      
      
      this.handlePlayerMovement();
      this.updateUI();
      this.updatePlayerState();
      
      if (this.debugMode) {
        this.updateDebugVisuals();
      }
    } catch (error) {
      // Handle error silently
    }
  }

  private updatePlayerState(): void {
    // Check ladder/rope state using continuous position-based detection
    this.updateClimbableState();
    
    // Enforce rope Y position lock
    this.enforceRopeYLock();
    
    // Check for holes player might fall through
    this.checkHoleCollisions();
    
    // Check for exit ladder completion
    this.checkExitLadderCompletion();
  }

  private updateClimbableState(): void {
    // Enhanced ladder detection with multiple contact points
    const playerCenterX = this.player.x;
    const playerCenterY = this.player.y;
    
    // Calculate detection points - center, bottom, and top areas of player
    const playerHalfHeight = this.player.displayHeight / 2;
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
    const jumpingFromRope = this.player.getData('jumpingFromRope');
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
    this.player.setData('detectionResults', detectionResults);
    
    // Priority system: Rope takes priority over ladder when both are detected
    // This allows natural ladder-to-rope transitions at the top of ladders
    if (onRope && onLadder) {
      // When both rope and ladder are detected, prioritize rope
      onLadder = false;
      detectionResults.push('RopePriority');
    }
    
    // Update player data
    this.player.setData('onLadder', onLadder);
    this.player.setData('onRope', onRope);
    
    // Initialize rope Y lock when first touching rope
    if (onRope && !this.player.getData('wasOnRope')) {
      // Calculate proper rope hanging position
      // Find the rope tile Y position and position player to hang from it
      let ropeYPosition = this.player.y; // Default fallback
      
      this.ropeTiles.children.entries.forEach((tile: any) => {
        // Account for tile positioning: tiles are positioned at center (pixelX + 16, pixelY + 16)
        const tileTileX = Math.floor((tile.x - 16) / GAME_CONFIG.tileSize);
        const tileTileY = Math.floor((tile.y - 16) / GAME_CONFIG.tileSize);
        
        // Check if this is the rope tile the player is on
        if (tileTileX === playerTileX && tileTileY === playerTileY) {
          // Position player to hang from the rope tile
          // Use rope tile center position for optimal hanging
          ropeYPosition = tile.y; // Hang at rope center
        }
      });
      
      this.player.setData('ropeY', ropeYPosition);
      // Set position after detection to avoid disrupting rope state
    }
    this.player.setData('wasOnRope', onRope);
  }
  
  private enforceRopeYLock(): void {
    const onRope = this.player.getData('onRope');
    const jumpingFromRope = this.player.getData('jumpingFromRope');
    
    // Don't enforce rope lock if jumping from rope
    if (onRope && !jumpingFromRope) {
      const lockedY = this.player.getData('ropeY');
      const wasOnRope = this.player.getData('wasOnRope');
      
      if (lockedY !== undefined) {
        // If just grabbed rope, set position immediately
        if (onRope && !wasOnRope) {
          this.player.setY(lockedY);
        }
        // Otherwise, enforce position if drifted
        else if (Math.abs(this.player.y - lockedY) > 0.1) {
          // Force position back to locked Y
          this.player.setY(lockedY);
          
          // Also update the physics body position to prevent drift
          const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
          playerBody.y = lockedY - playerBody.height / 2 - playerBody.offset.y;
        }
      }
    }
  }

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.gameState.score}`);
    this.levelText.setText(`LEVEL: ${this.gameState.currentLevel}`);
    this.livesText.setText(`LIVES: ${this.gameState.lives}`);
    this.goldText.setText(`GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`);
  }

  private handlePlayerMovement(): void {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerSprite = this.player;
    const speed = 200;

    // Get current climbing state
    const onLadder = this.player.getData('onLadder');
    const onRope = this.player.getData('onRope');
    const isClimbing = onLadder || onRope;

    // ALWAYS reset horizontal velocity
    playerBody.setVelocityX(0);
    let isMoving = false;

    // Horizontal movement (always allowed)
    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      playerBody.setVelocityX(-speed);
      playerSprite.play('player-run-left', true);
      isMoving = true;
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      playerBody.setVelocityX(speed);
      playerSprite.play('player-run-right', true);
      isMoving = true;
    }

    // Handle gravity and vertical movement based on climbing state
    if (isClimbing) {
      // CRITICAL: Disable gravity first
      playerBody.setGravityY(0);
      
      // Check for movement input - ropes allow horizontal movement and jumping down
      const onRope = this.player.getData('onRope');
      const movingUp = this.cursors.up.isDown || this.wasdKeys.W.isDown;
      const movingDown = this.cursors.down.isDown || this.wasdKeys.S.isDown;
      const movingHorizontal = isMoving; // Already determined above from left/right input
      
      // For ropes: ignore up input, but allow down (jump/drop from rope)
      const effectiveMovingUp = onRope ? false : movingUp;
      const effectiveMovingDown = movingDown; // Allow down movement for both ladders and ropes
      const hasAnyInput = effectiveMovingUp || effectiveMovingDown || movingHorizontal;
      
      if (hasAnyInput) {
        // Enable physics when ANY movement is detected
        playerBody.moves = true;
        
        // Handle vertical movement (only for ladders)
        if (effectiveMovingUp) {
          playerBody.setVelocityY(-speed);
          if (!movingHorizontal) {
            playerSprite.play('player-climb', true);
          }
          isMoving = true;
        } else if (effectiveMovingDown && !onRope) {
          // Ladder down movement
          playerBody.setVelocityY(speed);
          if (!movingHorizontal) {
            playerSprite.play('player-climb', true);
          }
          isMoving = true;
        } else if (effectiveMovingDown && onRope) {
          // Jump down from rope - release rope and enable gravity
          playerBody.moves = true;
          playerBody.setGravityY(800); // Re-enable gravity
          playerBody.setVelocityY(speed * 1.5); // Stronger initial downward velocity for jumping
          
          // Set jumping flag to prevent rope re-detection
          this.player.setData('jumpingFromRope', true);
          this.time.delayedCall(100, () => {
            this.player.setData('jumpingFromRope', false);
          });
          
          // Clear rope state to release from rope
          this.player.setData('onRope', false);
          this.player.setData('wasOnRope', false);
          this.player.setData('ropeY', undefined);
          
          // Use falling animation if available
          const movingLeft = this.cursors.left.isDown || this.wasdKeys.A.isDown;
          const movingRight = this.cursors.right.isDown || this.wasdKeys.D.isDown;
          if (movingLeft) {
            playerSprite.play('player-fall-left', true);
          } else if (movingRight) {
            playerSprite.play('player-fall-right', true);
          } else {
            playerSprite.play('player-fall-right', true); // Default falling animation
          }
          isMoving = true;
        } else if (movingHorizontal && onRope) {
          // Rope horizontal movement - zero all Y forces
          playerBody.setVelocityY(0);
          playerBody.setAccelerationY(0);
          
          // Use bar animations for rope movement
          const movingLeft = this.cursors.left.isDown || this.wasdKeys.A.isDown;
          if (movingLeft) {
            playerSprite.play('player-bar-left', true);
          } else {
            playerSprite.play('player-bar-right', true);
          }
        } else if (movingHorizontal && !onRope) {
          // Ladder horizontal movement
          playerBody.setVelocityY(0);
          playerBody.setAccelerationY(0);
        }
      } else {
        // CRITICAL FIX: Disable physics only when NO input at all
        // This prevents sliding while allowing horizontal movement
        playerBody.moves = false;
        playerBody.setVelocityY(0);
        playerBody.setAccelerationY(0);
        
        // For ropes, use stationary animation when not moving
        if (onRope) {
          // Use idle bar animation or first frame of bar sequence
          playerSprite.play('player-idle'); // Will be replaced with proper rope hang animation
        }
      }
    } else {
      // Re-enable physics when not climbing
      playerBody.moves = true;
      if (playerBody.gravity.y !== 800) {
        playerBody.setGravityY(800);
        playerBody.setAccelerationY(0);
      }
      // Let gravity handle vertical movement - don't interfere with Y velocity
    }

    // Play idle animation if not moving
    if (!isMoving) {
      if (playerSprite.anims.currentAnim?.key !== 'player-idle') {
        playerSprite.play('player-idle');
      }
    }
  }

  private collectGold(goldSprite: Phaser.GameObjects.Sprite): void {
    // Play gold collection sound
    this.soundManager.playSFX('getGold');
    
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
      
      // Check if this is the designated exit ladder
      const isExitLadder = this.exitLadderPosition && 
                          position.x === this.exitLadderPosition.x && 
                          position.y === this.exitLadderPosition.y;
      
      
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
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerGridX = Math.floor(this.player.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(this.player.y / GAME_CONFIG.tileSize);
    
    // Calculate target hole position based on direction
    let targetX = playerGridX + (direction === 'left' ? -1 : 1);
    let targetY = playerGridY + 1; // Dig one tile below and to the side
    
    // Check if player is on solid ground (can't dig while falling)
    if (!playerBody.onFloor() && !this.player.getData('onLadder')) {
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
    this.player.play(digAnimationKey);
    
    // Return to idle animation after digging
    this.time.delayedCall(500, () => {
      if (this.player.anims.currentAnim?.key.includes('hole-dig')) {
        this.player.play('player-idle');
      }
    });
  }

  private canDigAtPosition(gridX: number, gridY: number): boolean {
    // Check bounds
    if (gridX < 0 || gridX >= 28 || gridY < 0 || gridY >= 16) {
      return false;
    }
    
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
    const playerGridX = Math.floor(this.player.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(this.player.y / GAME_CONFIG.tileSize);
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    
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
      this.player.setDepth(1100); // Extra boost when near holes
    } else {
      this.player.setDepth(1000); // Normal depth
    }
    
    // Check if player is standing on a hole
    const holeKey = `${playerGridX},${playerGridY}`;
    const hole = this.holes.get(holeKey);
    
    if (hole && !hole.isDigging) {
      // Player is on a hole and not in digging animation - make them fall
      if (!this.player.getData('onLadder') && !this.player.getData('onRope')) {
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
      if (!this.player.getData('onLadder') && !this.player.getData('onRope')) {
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
      console.log(`🚪 COMPLETION CHECK: ExitSprites: ${this.exitLadderSprites.length}, FirstVisible: ${this.exitLadderSprites[0]?.visible}, GoldCollected: ${this.gameState.goldCollected}/${this.gameState.totalGold}`);
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
    const playerCenterX = this.player.x;
    const playerCenterY = this.player.y;
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
      
      console.log(`🚪 COMPLETION CHECK: On exit ladder! PlayerY: ${playerCenterY}, Threshold: ${ladderTopThreshold}`);
      
      if (playerCenterY <= ladderTopThreshold) {
        console.log('🎉 COMPLETING LEVEL!');
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
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    this.debugGraphics.clear();
    
    // 1. Red Rectangle: Visual sprite bounds
    const spriteBounds = {
      x: this.player.x - this.player.displayWidth / 2,
      y: this.player.y - this.player.displayHeight / 2,
      width: this.player.displayWidth,
      height: this.player.displayHeight
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
    const playerTileX = Math.floor(this.player.x / tileSize);
    const playerTileY = Math.floor(this.player.y / tileSize);
    
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
    this.debugGraphics.fillCircle(this.player.x, this.player.y, 4);
    
    // 5. Orange Dot: Body center point
    const bodyCenterX = playerBody.x + playerBody.width / 2;
    const bodyCenterY = playerBody.y + playerBody.height / 2;
    this.debugGraphics.fillStyle(0xff8800, 1);
    this.debugGraphics.fillCircle(bodyCenterX, bodyCenterY, 3);
    
    // Update debug text with all coordinate information
    this.updateDebugText(playerBody, bodyCenterX, bodyCenterY);
  }

  private updateDebugText(playerBody: Phaser.Physics.Arcade.Body, bodyCenterX: number, bodyCenterY: number): void {
    const onLadder = this.player.getData('onLadder');
    const onRope = this.player.getData('onRope');
    const isClimbing = onLadder || onRope;
    
    // Calculate current tile position
    const tileX = Math.floor(this.player.x / GAME_CONFIG.tileSize);
    const tileY = Math.floor(this.player.y / GAME_CONFIG.tileSize);
    
    // Track position changes for debugging sliding
    const prevX = this.player.getData('prevX') || this.player.x;
    const prevY = this.player.getData('prevY') || this.player.y;
    const positionDelta = {
      x: this.player.x - prevX,
      y: this.player.y - prevY
    };
    
    // Store current position for next frame comparison
    this.player.setData('prevX', this.player.x);
    this.player.setData('prevY', this.player.y);
    
    const debugInfo = [
      'DEBUG MODE - All Sprite & Body Coordinates',
      '(Press J to toggle off)',
      '',
      '=== SPRITE INFORMATION ===',
      `Sprite Center (x,y): (${this.player.x.toFixed(1)}, ${this.player.y.toFixed(1)})`,
      `Sprite Size: ${this.player.displayWidth.toFixed(1)} x ${this.player.displayHeight.toFixed(1)}`,
      `Sprite Scale: ${this.player.scaleX}`,
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
      `On Ladder: ${onLadder ? '✓' : '✗'}`,
      `On Rope: ${onRope ? '✓' : '✗'}`,
      `Is Climbing: ${isClimbing ? '✓' : '✗'}`,
      `Gravity Disabled: ${playerBody.gravity.y === 0 ? '✓' : '✗'}`,
      `Detection Points: ${this.player.getData('detectionResults')?.join(', ') || 'None'}`,
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
    
    if (this.levelTiles) {
      this.levelTiles.clear();
    }
  }
}