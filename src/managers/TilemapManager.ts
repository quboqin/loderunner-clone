/**
 * TilemapManager - Optimized tilemap-based rendering system
 * Replaces individual sprite tiles with efficient Phaser tilemap layers
 * Reduces sprite count from 400+ to minimal entities only
 */

import { Scene } from 'phaser';
import { GAME_CONFIG, TILE_TYPES } from '@/config/GameConfig';
import { Logger, LogCategory } from '@/utils/Logger';

export class TilemapManager {
  private scene: Scene;
  private tilemap!: Phaser.Tilemaps.Tilemap;
  private tileset!: Phaser.Tilemaps.Tileset | null;
  
  // Tilemap layers for different tile types
  private solidLayer!: Phaser.Tilemaps.TilemapLayer;
  private ladderLayer!: Phaser.Tilemaps.TilemapLayer;
  private ropeLayer!: Phaser.Tilemaps.TilemapLayer;
  private backgroundLayer!: Phaser.Tilemaps.TilemapLayer;
  
  // Tile data storage for quick lookups (2D array instead of Map)
  private tileData: number[][] = [];
  
  private logger = Logger.createCategoryLogger(LogCategory.LEVEL_LOADING);
  
  constructor(scene: Scene) {
    this.scene = scene;
  }
  
  /**
   * Create tilemap from level data
   * Replaces individual sprite creation with efficient tilemap layers
   */
  public createTilemap(levelTiles: number[][]): void {
    this.tileData = levelTiles;
    
    // Create blank tilemap
    this.tilemap = this.scene.make.tilemap({
      tileWidth: GAME_CONFIG.tileSize,
      tileHeight: GAME_CONFIG.tileSize,
      width: GAME_CONFIG.levelWidth,
      height: GAME_CONFIG.levelHeight
    });
    
    // Add tileset from loaded texture atlas
    // Note: We'll need to create a proper tileset image for this
    this.tileset = this.tilemap.addTilesetImage('tiles', 'tiles', GAME_CONFIG.tileSize, GAME_CONFIG.tileSize);
    
    if (!this.tileset) {
      this.logger.error('Failed to create tileset from texture atlas');
      return;
    }
    
    // Create layers for different tile types
    this.createLayers(levelTiles);
    
    // Set up collision properties
    this.setupCollisions();
    
    this.logger.debug(`Tilemap created: ${GAME_CONFIG.levelWidth}x${GAME_CONFIG.levelHeight} tiles`);
  }
  
  /**
   * Create tilemap layers from level data
   */
  private createLayers(levelTiles: number[][]): void {
    // Create data arrays for each layer
    const solidData: number[][] = [];
    const ladderData: number[][] = [];
    const ropeData: number[][] = [];
    const backgroundData: number[][] = [];
    
    // Initialize arrays
    for (let y = 0; y < GAME_CONFIG.levelHeight; y++) {
      solidData[y] = [];
      ladderData[y] = [];
      ropeData[y] = [];
      backgroundData[y] = [];
      
      for (let x = 0; x < GAME_CONFIG.levelWidth; x++) {
        const tileType = levelTiles[y][x];
        
        // Distribute tiles to appropriate layers
        // Use -1 for empty tiles in tilemap (0 is first tile index)
        solidData[y][x] = -1;
        ladderData[y][x] = -1;
        ropeData[y][x] = -1;
        backgroundData[y][x] = -1;
        
        switch (tileType) {
          case TILE_TYPES.BRICK:
          case TILE_TYPES.SOLID:
            solidData[y][x] = this.getTileIndex(tileType);
            break;
          case TILE_TYPES.LADDER:
            ladderData[y][x] = this.getTileIndex(tileType);
            break;
          case TILE_TYPES.ROPE:
            ropeData[y][x] = this.getTileIndex(tileType);
            break;
          case TILE_TYPES.EMPTY:
            // Empty tiles - no rendering needed
            break;
        }
      }
    }
    
    // Create tilemap layers
    if (!this.tileset) {
      this.logger.error('Cannot create layers without valid tileset');
      return;
    }
    
    this.backgroundLayer = this.tilemap.createBlankLayer('background', this.tileset)!;
    this.solidLayer = this.tilemap.createBlankLayer('solid', this.tileset)!;
    this.ladderLayer = this.tilemap.createBlankLayer('ladder', this.tileset)!;
    this.ropeLayer = this.tilemap.createBlankLayer('rope', this.tileset)!;
    
    // Populate layers with tile data
    this.solidLayer.putTilesAt(solidData, 0, 0);
    this.ladderLayer.putTilesAt(ladderData, 0, 0);
    this.ropeLayer.putTilesAt(ropeData, 0, 0);
    
    // Set layer depths
    this.backgroundLayer.setDepth(0);
    this.solidLayer.setDepth(10);
    this.ladderLayer.setDepth(15);
    this.ropeLayer.setDepth(15);
    
    // Apply scaling to match original sprite scale
    const scale = 1.6;
    this.solidLayer.setScale(scale);
    this.ladderLayer.setScale(scale);
    this.ropeLayer.setScale(scale);
    this.backgroundLayer.setScale(scale);
  }
  
  /**
   * Set up collision properties for tilemap layers
   */
  private setupCollisions(): void {
    // Set collision for solid tiles
    if (this.solidLayer) {
      // Set collision by tile property
      this.solidLayer.setCollisionByProperty({ collides: true });
    }
    
    // Ladders have special collision (only from above)
    if (this.ladderLayer) {
      // Custom collision handling for ladders will be done in collision callbacks
      this.ladderLayer.setCollisionByProperty({ platform: true });
    }
    
    // Ropes don't have collision (hang mechanics handled separately)
    // No collision setup needed for rope layer
    
    this.logger.debug('Tilemap collisions configured');
  }
  
  /**
   * Get tile index for tileset based on tile type
   * Maps our tile types to tileset frame indices
   */
  private getTileIndex(tileType: number): number {
    // Map tile types to tileset indices
    // This will need to match the actual tileset image arrangement
    switch (tileType) {
      case TILE_TYPES.BRICK:
        return 0; // First tile in tileset
      case TILE_TYPES.SOLID:
        return 1; // Second tile in tileset
      case TILE_TYPES.LADDER:
        return 2; // Third tile in tileset
      case TILE_TYPES.ROPE:
        return 3; // Fourth tile in tileset
      default:
        return -1; // Empty/no tile
    }
  }
  
  /**
   * Get tile type at grid position (optimized with 2D array)
   */
  public getTileAt(gridX: number, gridY: number): number {
    if (gridX < 0 || gridX >= GAME_CONFIG.levelWidth || 
        gridY < 0 || gridY >= GAME_CONFIG.levelHeight) {
      return TILE_TYPES.EMPTY;
    }
    
    return this.tileData[gridY][gridX];
  }
  
  /**
   * Set tile at position (for hole digging)
   */
  public setTileAt(gridX: number, gridY: number, tileType: number): void {
    if (gridX < 0 || gridX >= GAME_CONFIG.levelWidth || 
        gridY < 0 || gridY >= GAME_CONFIG.levelHeight) {
      return;
    }
    
    // Update internal data
    this.tileData[gridY][gridX] = tileType;
    
    // Update appropriate tilemap layer
    const tileIndex = this.getTileIndex(tileType);
    
    // Clear tile from all layers first
    this.solidLayer.removeTileAt(gridX, gridY);
    this.ladderLayer.removeTileAt(gridX, gridY);
    this.ropeLayer.removeTileAt(gridX, gridY);
    
    // Add tile to appropriate layer
    switch (tileType) {
      case TILE_TYPES.BRICK:
      case TILE_TYPES.SOLID:
        this.solidLayer.putTileAt(tileIndex, gridX, gridY);
        break;
      case TILE_TYPES.LADDER:
        this.ladderLayer.putTileAt(tileIndex, gridX, gridY);
        break;
      case TILE_TYPES.ROPE:
        this.ropeLayer.putTileAt(tileIndex, gridX, gridY);
        break;
    }
  }
  
  /**
   * Remove tile at position (for hole digging)
   */
  public removeTileAt(gridX: number, gridY: number): void {
    this.setTileAt(gridX, gridY, TILE_TYPES.EMPTY);
  }
  
  /**
   * Get tilemap layers for collision detection
   */
  public getLayers(): {
    solid: Phaser.Tilemaps.TilemapLayer,
    ladder: Phaser.Tilemaps.TilemapLayer,
    rope: Phaser.Tilemaps.TilemapLayer
  } {
    return {
      solid: this.solidLayer,
      ladder: this.ladderLayer,
      rope: this.ropeLayer
    };
  }
  
  /**
   * Clean up tilemap resources
   */
  public destroy(): void {
    if (this.tilemap) {
      this.tilemap.destroy();
    }
    
    this.tileData = [];
    
    this.logger.debug('TilemapManager destroyed');
  }
  
  /**
   * Check if position is walkable
   */
  public isWalkable(gridX: number, gridY: number): boolean {
    const tileType = this.getTileAt(gridX, gridY);
    return tileType === TILE_TYPES.EMPTY || 
           tileType === TILE_TYPES.LADDER || 
           tileType === TILE_TYPES.ROPE;
  }
  
  /**
   * Check if position has solid ground
   */
  public isSolid(gridX: number, gridY: number): boolean {
    const tileType = this.getTileAt(gridX, gridY);
    return tileType === TILE_TYPES.BRICK || 
           tileType === TILE_TYPES.SOLID;
  }
  
  /**
   * Check if position is climbable
   */
  public isClimbable(gridX: number, gridY: number): boolean {
    const tileType = this.getTileAt(gridX, gridY);
    return tileType === TILE_TYPES.LADDER || 
           tileType === TILE_TYPES.ROPE;
  }
}