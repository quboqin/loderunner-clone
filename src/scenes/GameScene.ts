import { Scene } from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '@/config/GameConfig';
import { GameState } from '@/types/GameTypes';
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
  private soundManager!: SoundManager;
  private solidTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ladderTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ropeTiles!: Phaser.Physics.Arcade.StaticGroup;

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
    
    
  }

  private initializeAudio(): void {
    this.soundManager = SoundManager.getInstance(this);
    this.soundManager.initializeSounds();
  }

  private createCollisionGroups(): void {
    // Create static groups for different tile types
    this.solidTiles = this.physics.add.staticGroup();
    this.ladderTiles = this.physics.add.staticGroup();
    this.ropeTiles = this.physics.add.staticGroup();
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
    const level1Data = levelsData.levels['level-001'];
    
    // Parse level data using AssetManager
    const levelInfo = AssetManager.parseLevelData(level1Data);
    
    // Create tilemap from parsed data
    this.createTilemap(levelInfo.tiles);
    
    // Set player starting position
    this.registry.set('playerStart', levelInfo.playerStart);
    
    // Create gold objects
    levelInfo.gold.forEach((goldPos: { x: number; y: number }) => {
      const gold = this.add.sprite(goldPos.x + 16, goldPos.y + 16, 'tiles', 'gold');
      gold.setScale(1.6); // Keep scaling for gold to match tile size
      gold.setData('type', 'gold');
      gold.setInteractive();
      
      // Add collision detection for gold collection
      gold.on('pointerdown', () => {
        this.collectGold(gold);
      });
      
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
        break;
      
      case 3: // Ladder - climbable, no solid collision
        this.physics.add.existing(tile, true);
        this.ladderTiles.add(tile);
        break;
        
      case 4: // Rope - climbable, no solid collision
        this.physics.add.existing(tile, true);
        this.ropeTiles.add(tile);
        break;
        
      case 6: // Exit/trap - special handling later
        // No collision for now
        break;
    }
  }

  private createPlayer(): void {
    const startPos = this.registry.get('playerStart') || { x: 400, y: 400 };
    
    
    // Create player sprite using IBM runner atlas
    this.player = this.add.sprite(startPos.x, startPos.y, 'runner', 'runner_00');
    this.player.setScale(1.6); // Scale from 20x22 to ~32x32
    this.player.play('player-idle');
    
    this.physics.add.existing(this.player);
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    // With 1.6x scaling, sprite is ~32x35 display size  
    // Use smaller collision box to fit through single-tile gaps (32px tiles)
    playerBody.setSize(16, 28); // Smaller width and height for better fit
    
    
    // Confirmed: Y offset > 4 causes falling through floor
    // Y offset = 4 is the maximum safe value - accept small visual gap
    playerBody.setOffset(8, 4); // Center horizontally, safe Y offset with minimal gap
    
    // CRITICAL FIX: Explicitly enable gravity for the player body
    // Individual bodies don't inherit global gravity automatically in Phaser
    playerBody.setGravityY(800); // Match the global gravity
    
    
  }

  private setupCollisions(): void {
    // Player collides with solid tiles (walls, floors, bricks)
    this.physics.add.collider(this.player, this.solidTiles);
    
    // Player can overlap with ladders and ropes (for climbing detection)
    this.physics.add.overlap(this.player, this.ladderTiles, this.handleLadderInteraction, undefined, this);
    this.physics.add.overlap(this.player, this.ropeTiles, this.handleRopeInteraction, undefined, this);
  }

  private handleLadderInteraction(_player: any, ladder: any): void {
    // Store ladder reference for climbing mechanics
    this.player.setData('onLadder', true);
    this.player.setData('ladderTile', ladder);
  }

  private handleRopeInteraction(_player: any, rope: any): void {
    // Store rope reference for climbing mechanics
    this.player.setData('onRope', true);
    this.player.setData('ropeTile', rope);
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

    this.add.text(GAME_CONFIG.width - padding, padding, 
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
  }

  private updateCounter = 0;

  update(): void {
    try {
      this.updateCounter++;
      
      
      this.handlePlayerMovement();
      this.updateUI();
      this.updatePlayerState();
    } catch (error) {
      // Handle error silently
    }
  }

  private updatePlayerState(): void {
    // Clear ladder/rope state if not overlapping anymore
    this.player.setData('onLadder', false);
    this.player.setData('onRope', false);
    
  }

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.gameState.score}`);
    this.levelText.setText(`LEVEL: ${this.gameState.currentLevel}`);
    this.livesText.setText(`LIVES: ${this.gameState.lives}`);
  }

  private handlePlayerMovement(): void {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const playerSprite = this.player;
    const speed = 200;

    // ONLY reset horizontal velocity - DON'T touch vertical velocity to allow gravity
    playerBody.setVelocityX(0);
    // DO NOT call setVelocity(0) or setVelocityY(0) here - it cancels gravity!
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

    // Vertical movement (only on ladders or ropes)
    const onLadder = this.player.getData('onLadder');
    const onRope = this.player.getData('onRope');
    
    
    if (onLadder || onRope) {
      // Disable gravity when climbing
      playerBody.setGravityY(0);
      
      if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
        playerBody.setVelocityY(-speed);
        if (!isMoving) {
          playerSprite.play('player-climb', true);
        }
        isMoving = true;
      } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
        playerBody.setVelocityY(speed);
        if (!isMoving) {
          playerSprite.play('player-climb', true);
        }
        isMoving = true;
      } else {
        // Stop vertical movement when not pressing up/down on ladder
        playerBody.setVelocityY(0);
      }
    } else {
      // Re-enable gravity when not climbing
      if (playerBody.gravity.y !== 800) {
        playerBody.setGravityY(800);
      }
      // Let gravity handle vertical movement - don't set velocity here
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
    
    // Remove gold sprite
    goldSprite.destroy();
    
    // Check if level is complete
    if (this.gameState.goldCollected >= this.gameState.totalGold) {
      this.completeLevel();
    }
  }

  private digHole(_direction: 'left' | 'right'): void {
    // Play digging sound
    this.soundManager.playSFX('dig');
    
    // Basic hole digging logic (placeholder)
    // Digging hole
    
    // TODO: Implement actual hole digging mechanics
    // - Check if player is on ground
    // - Check if there's a brick below to dig
    // - Create hole sprite and set timer for regeneration
  }

  private completeLevel(): void {
    // Play level completion music
    this.soundManager.playLevelComplete();
    
    // Add level completion bonus
    this.gameState.score += 1000;
    
    // Show level complete message
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    const completeText = this.add.text(centerX, centerY, 'LEVEL COMPLETE!', {
      fontSize: '48px',
      color: '#ffff00',
      fontFamily: 'Arial, sans-serif',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    // Transition to next level or game complete after delay
    this.time.delayedCall(3000, () => {
      completeText.destroy();
      // For now, restart the same level
      this.scene.restart();
    });
  }
}