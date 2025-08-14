/**
 * LevelSystem - Manages level loading, tilemap creation, and level progression
 * Extracted from GameScene monolith to improve maintainability and separation of concerns
 * Handles level data parsing, tile management, gold collection, and exit mechanics
 */
import { BaseSystem } from './BaseSystem';
import { GameScene } from '@/scenes/GameScene';
import { AssetManager } from '@/managers/AssetManager';
// Removed unused import
import { GAME_CONFIG, GAME_MECHANICS, TILE_TYPES } from '@/config/GameConfig';
import { LevelLogger } from '@/utils/Logger';

export interface GoldCount {
  collected: number;
  total: number;
}

export class LevelSystem extends BaseSystem {
  private levelTiles: Map<string, Phaser.GameObjects.Sprite> = new Map();
  private tileGrid: (Phaser.GameObjects.Sprite | null)[][] = []; // Optimized 2D array for O(1) lookups
  private goldSprites!: Phaser.Physics.Arcade.StaticGroup;
  private exitLadderSprites: Phaser.GameObjects.Sprite[] = [];
  private exitMarker: Phaser.GameObjects.Text | null = null;
  private levelInfo: any = null; // Cached parsed level data
  private gameScene: GameScene;
  
  constructor(scene: GameScene) {
    super(scene);
    this.gameScene = scene;
  }
  
  protected initialize(): void {
    // Initialize collision groups
    this.goldSprites = this.scene.physics.add.staticGroup();
    
    // Initialize tile grid with proper dimensions
    this.initializeTileGrid();
    
    this.logger.debug('LevelSystem initialized');
  }
  
  private initializeTileGrid(): void {
    // Initialize 2D array for O(1) tile lookups
    this.tileGrid = [];
    for (let y = 0; y < GAME_CONFIG.levelHeight; y++) {
      this.tileGrid[y] = [];
      for (let x = 0; x < GAME_CONFIG.levelWidth; x++) {
        this.tileGrid[y][x] = null;
      }
    }
  }
  
  public update(_time: number, _delta: number): void {
    // Level system is mostly static, no active updates needed
    // Exit detection and gold collection are handled via collision events
  }
  
  public cleanup(): void {
    // Clean up level tiles
    this.levelTiles.forEach((tile) => {
      if (tile && tile.scene) {
        tile.destroy();
      }
    });
    this.levelTiles.clear();
    
    // Clear tile grid
    this.tileGrid = [];
    
    // Clean up gold sprites
    if (this.goldSprites && this.goldSprites.children) {
      this.goldSprites.clear(true, true);
    }
    
    // Clean up exit elements
    this.exitLadderSprites.forEach(sprite => {
      if (sprite && sprite.scene) {
        sprite.destroy();
      }
    });
    this.exitLadderSprites = [];
    
    if (this.exitMarker && this.exitMarker.scene) {
      this.exitMarker.destroy();
      this.exitMarker = null;
    }
    
    this.logger.debug('LevelSystem cleaned up');
  }
  
  public getSystemName(): string {
    return 'LevelSystem';
  }
  
  public isActive(): boolean {
    return this.levelTiles.size > 0;
  }
  
  /**
   * Get the level tiles map for external access
   */
  public getLevelTiles(): Map<string, Phaser.GameObjects.Sprite> {
    return this.levelTiles;
  }
  
  /**
   * Get the gold sprites group for collision detection
   */
  public getGoldSprites(): Phaser.Physics.Arcade.StaticGroup {
    return this.goldSprites;
  }
  
  /**
   * Get current level info
   */
  public getLevelInfo(): any {
    return this.levelInfo;
  }
  
  /**
   * Get exit ladder sprites for completion detection
   */
  public getExitLadderSprites(): Phaser.GameObjects.Sprite[] {
    return this.exitLadderSprites;
  }
  
  // === METHODS TO BE EXTRACTED FROM GAMESCENE ===
  // These will be moved incrementally from GameScene
  
  /**
   * Load and create a level
   * Extracted from GameScene.createLevel()
   */
  public loadLevel(levelNumber: number, gameState: any): void {
    // Set camera background
    this.gameScene.cameras.main.setBackgroundColor('#000000');
    
    // Load level data from classic levels
    const levelsData = this.scene.cache.json.get('classic-levels');
    const levelKey = `level-${levelNumber.toString().padStart(3, '0')}`;
    LevelLogger.debug(`Loading level key: ${levelKey}`);
    let currentLevelData = levelsData.levels[levelKey];
    
    // If level doesn't exist, fallback to level 1
    if (!currentLevelData) {
      gameState.currentLevel = 1;
      currentLevelData = levelsData.levels['level-001'];
    }
    
    // Parse level data using AssetManager and cache it for reuse
    this.levelInfo = AssetManager.parseLevelData(currentLevelData);
    
    // Create tilemap from parsed data
    this.createTilemap(this.levelInfo.tiles);
    
    // Set player starting position
    this.scene.registry.set('playerStart', this.levelInfo.playerStart);
    
    // Create gold objects
    this.createGoldSprites(gameState);
    
    this.logger.debug(`Level ${levelNumber} loaded successfully`);
  }
  
  /**
   * Get tile type at grid position
   * Optimized with O(1) 2D array lookup instead of Map string key lookup
   */
  public getTileType(gridX: number, gridY: number): number {
    // Bounds check
    if (gridX < 0 || gridX >= GAME_CONFIG.levelWidth || 
        gridY < 0 || gridY >= GAME_CONFIG.levelHeight) {
      return TILE_TYPES.EMPTY;
    }
    
    // O(1) lookup from 2D array
    const tile = this.tileGrid[gridY][gridX];
    
    if (!tile) {
      return TILE_TYPES.EMPTY;
    }
    
    // Use stored tile type data
    const tileType = tile.getData('tileType');
    if (tileType) {
      return tileType;
    }
    
    // Fallback: Map sprite frames to tile types
    const frame = tile.frame.name;
    if (frame.includes('brick')) return TILE_TYPES.BRICK;
    if (frame.includes('solid') || frame.includes('wall')) return TILE_TYPES.SOLID;
    if (frame.includes('ladder')) return TILE_TYPES.LADDER;
    if (frame.includes('rope')) return TILE_TYPES.ROPE;
    
    return TILE_TYPES.EMPTY;
  }
  
  /**
   * Check if tile is standable (walkable)
   * Extracted from GameScene.isTileStandable()
   */
  public isTileStandable(gridX: number, gridY: number): boolean {
    // A tile is standable if it's solid (brick/solid) or climbable (ladder/rope)
    // Empty tiles are NOT standable - entities fall through empty space
    const holeKey = `${gridX},${gridY}`;
    
    // Special case: Check if there's a guard trapped in this hole
    // Guards in holes can be stood upon (Rule 8) - delegate to GameScene
    if (this.gameScene.getHoleSystem().getHoles().has(holeKey)) {
      return this.gameScene.hasGuardsInHole(holeKey);
    }
    
    const tileType = this.getTileType(gridX, gridY);
    return tileType === TILE_TYPES.BRICK ||   // Can stand on diggable bricks
           tileType === TILE_TYPES.SOLID ||   // Can stand on solid blocks
           tileType === TILE_TYPES.LADDER ||  // Can climb ladders
           tileType === TILE_TYPES.ROPE;      // Can hang on ropes
  }
  
  /**
   * Check if tile is solid (collision)
   * Extracted from GameScene.isTileSolid()
   */
  public isTileSolid(gridX: number, gridY: number): boolean {
    const tileType = this.getTileType(gridX, gridY);
    return tileType === TILE_TYPES.BRICK ||
           tileType === TILE_TYPES.SOLID;
  }
  
  /**
   * Reveal exit ladder when all gold collected
   * Extracted from GameScene.revealExitLadder()
   */
  public revealExitLadder(): void {
    if (!this.levelInfo?.allSPositions || this.levelInfo.allSPositions.length === 0) {
      return; // No S ladders in this level
    }

    // Create ladder sprites for all S positions
    this.levelInfo.allSPositions.forEach((position: { x: number; y: number }, index: number) => {
      const ladder = this.scene.add.sprite(
        position.x + GAME_CONFIG.halfTileSize, 
        position.y + GAME_CONFIG.halfTileSize, 
        'tiles', 
        'ladder'
      );
      ladder.setScale(1.6);
      ladder.setDepth(100);
      ladder.setAlpha(0); // Start invisible
      
      // Calculate grid coordinates first
      const gridX = position.x / GAME_CONFIG.tileSize;
      const gridY = position.y / GAME_CONFIG.tileSize;
      const tileKey = `${gridX},${gridY}`;
      
      // Set tile data so collision detection recognizes this as a ladder
      ladder.setData('tileType', TILE_TYPES.LADDER); // Ladder tile type
      ladder.setData('gridX', gridX);
      ladder.setData('gridY', gridY);
      
      // Add physics for ladder collision detection - delegate to GameScene
      this.scene.physics.add.existing(ladder, true);
      this.gameScene.getLadderTiles().add(ladder);
      this.gameScene.getSolidTiles().add(ladder); // Needed for platform-style collision from above
      
      // Store reference to the created sprites
      this.exitLadderSprites.push(ladder);
      
      // Store in level tiles for consistency (both Map and 2D array)
      this.levelTiles.set(tileKey, ladder);
      if (gridY >= 0 && gridY < GAME_CONFIG.levelHeight && 
          gridX >= 0 && gridX < GAME_CONFIG.levelWidth) {
        this.tileGrid[gridY][gridX] = ladder; // O(1) storage
      }
      
      // Fade in animation with staggered timing
      this.scene.tweens.add({
        targets: ladder,
        alpha: 1,
        duration: 1000,
        delay: index * 200, // Stagger the animations
        ease: 'Power2'
      });
    });
    
    // Create exit marker at the highest accessible position
    this.createExitMarker();

    // Delegate sound and UI to GameScene
    this.gameScene.getSoundManager().playSFX('pass'); // Using existing 'pass' sound
    
    // Show message
    const message = this.scene.add.text(this.gameScene.cameras.main.centerX, this.gameScene.cameras.main.centerY - 100, 
      'EXIT LADDER REVEALED!', {
      fontSize: '32px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5, 0.5).setDepth(400);
    
    // Animate message
    this.scene.tweens.add({
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
  
  /**
   * Check if player has completed the level
   * Extracted from GameScene.checkExitLadderCompletion()
   */
  public checkExitCompletion(playerGridX: number, playerGridY: number): boolean {
    // Don't check completion if all gold hasn't been collected yet
    const goldCount = this.getGoldCount();
    if (goldCount.collected < goldCount.total) {
      return false;
    }
    
    // Only check if exit ladder sprites exist and are actually visible (alpha > 0)
    // Exit ladders use alpha for visibility, not the visible property
    if (this.exitLadderSprites.length === 0 || !this.exitLadderSprites[0] || this.exitLadderSprites[0].alpha <= 0) {
      return false;
    }

    // Only check completion for the designated exit ladder position
    if (!this.levelInfo?.exitLadder) {
      return false;
    }

    // Get exit ladder position
    const exitLadderTileX = this.levelInfo.exitLadder.x / GAME_CONFIG.tileSize;
    const exitLadderTileY = this.levelInfo.exitLadder.y / GAME_CONFIG.tileSize;
    
    // Find the highest accessible position above the exit ladder
    const highestAccessibleY = this.findHighestAccessiblePosition(exitLadderTileX, exitLadderTileY);
    
    // Check if player is at the highest accessible position  
    return playerGridX === exitLadderTileX && playerGridY === highestAccessibleY;
  }
  
  /**
   * Get gold collection stats
   */
  public getGoldCount(): GoldCount {
    const gameState = this.scene.registry.get('gameState') || { goldCollected: 0, totalGold: 0 };
    return {
      collected: gameState.goldCollected,
      total: gameState.totalGold
    };
  }
  
  /**
   * Handle gold collection
   * Extracted from GameScene.collectGold()
   */
  public collectGold(goldSprite: Phaser.GameObjects.Sprite): void {
    // Delegate gold collection sound to Player
    this.gameScene.getPlayer().collectGold();
    
    // Update game state
    const gameState = this.scene.registry.get('gameState');
    if (!gameState) {
      this.logger.warn('GameState not found in registry during gold collection');
      return;
    }
    
    gameState.goldCollected++;
    gameState.score += 100;
    
    // Remove gold from collision group first to prevent multiple collections
    this.goldSprites.remove(goldSprite);
    
    // Add collection animation - scale up and fade out
    this.scene.tweens.add({
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
    const scoreText = this.scene.add.text(goldSprite.x, goldSprite.y - 20, '+100', {
      fontSize: '18px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5, 0.5).setDepth(300);
    
    // Animate score popup
    this.scene.tweens.add({
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
    if (gameState.goldCollected >= gameState.totalGold) {
      this.revealExitLadder();
    }
  }
  
  /**
   * Create tilemap from level data
   * Optimized with 2D array storage for O(1) lookups
   */
  private createTilemap(tiles: number[][]): void {
    // Re-initialize tile grid for new level
    this.initializeTileGrid();
    
    tiles.forEach((row, y) => {
      row.forEach((tileType, x) => {
        if (tileType !== 0) { // Skip empty tiles
          const pixelX = x * GAME_CONFIG.tileSize;
          const pixelY = y * GAME_CONFIG.tileSize;
          
          const frameKey = AssetManager.getTileFrame(tileType);
          const tile = this.scene.add.sprite(pixelX + GAME_CONFIG.halfTileSize, pixelY + GAME_CONFIG.halfTileSize, 'tiles', frameKey);
          tile.setScale(1.6); // Keep scaling for tiles to maintain proper level size
          tile.setData('tileType', tileType);
          tile.setData('gridX', x);
          tile.setData('gridY', y);
          
          // Store tile reference in both Map (for compatibility) and 2D array (for performance)
          const tileKey = `${x},${y}`;
          this.levelTiles.set(tileKey, tile);
          this.tileGrid[y][x] = tile; // O(1) storage
          
          // Add collision bodies based on tile type - delegate to CollisionSystem
          this.gameScene.getCollisionSystem().addTileCollision(tile, tileType);
        }
      });
    });
  }
  
  /**
   * Create gold sprites from level data
   * Extracted from GameScene.createLevel()
   */
  private createGoldSprites(gameState: any): void {
    this.levelInfo.gold.forEach((goldPos: { x: number; y: number }) => {
      const gold = this.scene.add.sprite(goldPos.x + GAME_CONFIG.halfTileSize, goldPos.y + GAME_CONFIG.halfTileSize, 'tiles', 'gold');
      gold.setScale(1.6); // Keep scaling for gold to match tile size
      gold.setData('type', 'gold');
      gold.setDepth(GAME_MECHANICS.DEPTHS.GOLD); // Ensure gold renders above background elements
      
      // Add physics body for collision detection
      this.scene.physics.add.existing(gold, true); // true = static body
      this.goldSprites.add(gold);
      
      gameState.totalGold++;
    });
  }
  
  /**
   * Create exit marker UI
   * Extracted from GameScene.createExitMarker()
   */
  private createExitMarker(): void {
    if (!this.levelInfo?.exitLadder) {
      return;
    }
    
    // Get exit ladder position and find highest accessible position
    const exitLadderTileX = this.levelInfo.exitLadder.x / GAME_CONFIG.tileSize;
    const exitLadderTileY = this.levelInfo.exitLadder.y / GAME_CONFIG.tileSize;
    const highestAccessibleY = this.findHighestAccessiblePosition(exitLadderTileX, exitLadderTileY);
    
    // Calculate pixel position for the exit marker
    const markerX = exitLadderTileX * GAME_CONFIG.tileSize + GAME_CONFIG.tileSize / 2;
    const markerY = highestAccessibleY * GAME_CONFIG.tileSize + GAME_CONFIG.tileSize / 2;
    
    // Remove existing exit marker if any
    if (this.exitMarker) {
      this.exitMarker.destroy();
    }
    
    // Create exit marker text
    this.exitMarker = this.scene.add.text(markerX, markerY, 'EXIT', {
      fontSize: '16px',
      color: '#FF0000',
      fontFamily: 'Arial Black, sans-serif',
      backgroundColor: '#FFFF00',
      padding: { x: 4, y: 2 },
      stroke: '#000000',
      strokeThickness: 2
    }).setOrigin(0.5).setDepth(300);
    
    // Add pulsing animation to make it more visible
    this.scene.tweens.add({
      targets: this.exitMarker,
      alpha: 0.5,
      duration: 800,
      ease: 'Power2',
      yoyo: true,
      repeat: -1
    });
    
    this.logger.debug(`Exit marker created at position (${markerX}, ${markerY}) for tile (${exitLadderTileX}, ${highestAccessibleY})`);
  }
  
  /**
   * Find highest accessible position for exit detection
   * Extracted from GameScene.findHighestAccessiblePosition()
   */
  private findHighestAccessiblePosition(ladderX: number, ladderY: number): number {
    // Start from the exit ladder position and move upward
    // Find the highest position that becomes accessible due to this ladder
    
    let highestY = ladderY; // Start at the ladder position
    
    // Move upward from the ladder position, checking each tile above
    for (let y = ladderY - 1; y >= 0; y--) {
      const tileKey = `${ladderX},${y}`;
      const tile = this.levelTiles.get(tileKey);
      
      // If there's a solid tile (brick, wall, solid block), we can't go higher
      if (tile && tile.getData('tileType')) {
        const tileType = tile.getData('tileType');
        if (tileType === TILE_TYPES.BRICK || tileType === TILE_TYPES.SOLID) { // Brick or solid block
          break; // Can't go through solid tiles
        }
      }
      
      // This position is accessible (empty space, ladder, or rope)
      highestY = y;
      
      // If we reach the top of the level, stop
      if (y === 0) {
        break;
      }
    }
    
    this.logger.debug(`Highest accessible position above exit ladder at (${ladderX}, ${ladderY}): (${ladderX}, ${highestY})`);
    return highestY;
  }
  
  /**
   * Update tile in the optimized 2D grid
   * Used by HoleSystem when restoring tiles after hole fills
   */
  public setTileInGrid(gridX: number, gridY: number, tile: Phaser.GameObjects.Sprite | null): void {
    if (gridX >= 0 && gridX < GAME_CONFIG.levelWidth && 
        gridY >= 0 && gridY < GAME_CONFIG.levelHeight) {
      this.tileGrid[gridY][gridX] = tile;
    }
  }
}