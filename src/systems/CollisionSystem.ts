/**
 * CollisionSystem - Manages physics groups and collision detection setup
 * Extracted from GameScene monolith to improve maintainability and separation of concerns
 * Handles physics world setup, static groups, and collision detection between game entities
 */
import { BaseSystem } from './BaseSystem';
import { GameScene } from '@/scenes/GameScene';
import { GAME_CONFIG, GAME_MECHANICS, TILE_TYPES } from '@/config/GameConfig';
import { GuardState } from '@/entities/Guard';
import { PhysicsLogger } from '@/utils/Logger';

export class CollisionSystem extends BaseSystem {
  // Physics Groups - moved from GameScene
  private solidTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ladderTiles!: Phaser.Physics.Arcade.StaticGroup;
  private ropeTiles!: Phaser.Physics.Arcade.StaticGroup;
  
  constructor(scene: GameScene) {
    super(scene);
  }
  
  protected initialize(): void {
    this.logger.debug('CollisionSystem initialized');
  }
  
  public update(_time: number, _delta: number): void {
    // Collision system handles detection setup, not active updates
    // Active collision checks are handled by physics engine and callbacks
  }
  
  public cleanup(): void {
    // Clean up physics groups
    if (this.solidTiles && this.solidTiles.children) {
      this.solidTiles.clear(true, true);
    }
    if (this.ladderTiles && this.ladderTiles.children) {
      this.ladderTiles.clear(true, true);
    }
    if (this.ropeTiles && this.ropeTiles.children) {
      this.ropeTiles.clear(true, true);
    }
    
    this.logger.debug('CollisionSystem cleaned up');
  }
  
  public getSystemName(): string {
    return 'CollisionSystem';
  }
  
  public isActive(): boolean {
    return this.solidTiles !== undefined && 
           this.ladderTiles !== undefined && 
           this.ropeTiles !== undefined;
  }
  
  // === PHYSICS GROUP ACCESS FOR OTHER SYSTEMS ===
  
  /**
   * Get solid tiles group for tile collision and other systems
   */
  public getSolidTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.solidTiles;
  }
  
  /**
   * Get ladder tiles group for climb detection and other systems  
   */
  public getLadderTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.ladderTiles;
  }
  
  /**
   * Get rope tiles group for climb detection and other systems
   */
  public getRopeTiles(): Phaser.Physics.Arcade.StaticGroup {
    return this.ropeTiles;
  }
  
  // === METHODS TO BE EXTRACTED FROM GAMESCENE ===
  // These will be moved incrementally from GameScene
  
  /**
   * Initialize physics world settings
   * Extracted from GameScene.createCollisionGroups()
   */
  public initializePhysicsWorld(): void {
    // Set world bounds to prevent entities from escaping game world
    // Match world size to configured level size (tiles * tileSize)
    const levelWidth = GAME_CONFIG.levelWidth * GAME_CONFIG.tileSize;
    const levelHeight = GAME_CONFIG.levelHeight * GAME_CONFIG.tileSize;
    this.scene.physics.world.setBounds(0, 0, levelWidth, levelHeight);
    
    PhysicsLogger.debug(`World bounds set: ${levelWidth}x${levelHeight} pixels (unscaled coordinates)`);
  }
  
  /**
   * Create static physics groups for tile collision detection
   * Extracted from GameScene.createCollisionGroups()
   */
  public initializePhysicsGroups(): void {
    // Create static groups for different tile types
    this.solidTiles = this.scene.physics.add.staticGroup();
    this.ladderTiles = this.scene.physics.add.staticGroup();
    this.ropeTiles = this.scene.physics.add.staticGroup();
    
    PhysicsLogger.debug('Physics groups created: solidTiles, ladderTiles, ropeTiles');
  }
  
  /**
   * Set up collision detection between all game entities
   * Extracted from GameScene.setupCollisions()
   */
  public setupEntityCollisions(): void {
    const gameScene = this.scene as GameScene;
    const player = gameScene.getPlayer();
    const inputManager = gameScene.getInputManager();
    const levelSystem = gameScene.getLevelSystem();
    
    // Player collides with solid tiles (walls, floors, bricks, and ladder tops)
    this.scene.physics.add.collider(player.sprite, this.solidTiles, undefined, (playerSprite: any, tile: any) => {
      const playerBody = playerSprite.body as Phaser.Physics.Arcade.Body;
      const tileData = tile.getData('tileType');
      
      // Special handling for ladders - only collide from above (platform behavior)
      if (tileData === TILE_TYPES.LADDER) { // Ladder tile
        // Allow collision only if player is falling/moving down onto ladder top
        // Block collision if player is moving up through ladder from below
        const playerBottom = playerBody.y + playerBody.height;
        const tileTop = tile.body.y;
        const movingUp = playerBody.velocity.y < 0;
        
        // Get climbing state and movement input
        const climbingState = player.getClimbingState();
        const hasDownInput = inputManager.isDownPressed();
        
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
    }, gameScene);
    
    // Player collision with gold - automatic collection
    this.scene.physics.add.overlap(player.sprite, levelSystem.getGoldSprites(), (_player: any, gold: any) => {
      levelSystem.collectGold(gold as Phaser.GameObjects.Sprite);
    }, undefined, gameScene);
    
    PhysicsLogger.debug('Entity collisions set up: Player vs Tiles, Player vs Gold');
    // Note: Ladder and rope detection now handled by position-based continuous detection
    // in updateClimbableState() method - no overlap handlers needed
  }
  
  /**
   * Set up guard-to-guard collision detection to prevent overlapping
   * Extracted from GameScene.setupGuardToGuardCollisions()
   */
  public setupGuardCollisions(guards: any[]): void {
    // Set up collision between each pair of guards to prevent overlapping
    for (let i = 0; i < guards.length; i++) {
      for (let j = i + 1; j < guards.length; j++) {
        const guardA = guards[i];
        const guardB = guards[j];
        
        // Add collision between the two guards
        this.scene.physics.add.collider(guardA.sprite, guardB.sprite, () => {
          // When guards collide, make them bounce slightly and change direction
          this.handleGuardToGuardCollision(guardA, guardB);
        });
      }
    }
    
    PhysicsLogger.debug(`Set up ${guards.length * (guards.length - 1) / 2} guard-to-guard collision pairs`);
  }
  
  /**
   * Handle collision between two guards
   * Extracted from GameScene.handleGuardToGuardCollision()
   */
  private handleGuardToGuardCollision(guardA: any, guardB: any): void {
    const guardAState = guardA.getState();
    const guardBState = guardB.getState();
    
    // Use imported GuardState enum
    
    // Don't handle collision if either guard is stunned in a hole
    if (guardAState === GuardState.STUNNED_IN_HOLE || guardBState === GuardState.STUNNED_IN_HOLE) {
      return; // No collision handling for stunned guards
    }
    
    // Special handling for guards in holes - they can help each other climb out
    if (guardAState === GuardState.IN_HOLE && guardBState === GuardState.IN_HOLE) {
      // Both guards are in holes - one can help the other climb out
      guardA.helpGuardClimb(guardB);
      return;
    }
    
    if (guardAState === GuardState.IN_HOLE) {
      // Guard A is in hole - Guard B can help it climb out
      guardB.helpGuardClimb(guardA);
      return;
    }
    
    if (guardBState === GuardState.IN_HOLE) {
      // Guard B is in hole - Guard A can help it climb out  
      guardA.helpGuardClimb(guardB);
      return;
    }
    
    // Normal collision handling for moveable guards
    if (guardAState !== GuardState.REBORN && guardAState !== GuardState.ESCAPING_HOLE &&
        guardBState !== GuardState.REBORN && guardBState !== GuardState.ESCAPING_HOLE) {
      
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
  
  /**
   * Bounce guard in specified direction
   * Extracted from GameScene.bounceGuard()
   */
  private bounceGuard(guard: any, direction: number): void {
    // Don't bounce guards that are in holes
    const guardState = guard.getState();
    
    if (guardState === GuardState.STUNNED_IN_HOLE || 
        guardState === GuardState.IN_HOLE || 
        guardState === GuardState.ESCAPING_HOLE ||
        guard.getCurrentHole() !== null) {
      return; // Don't bounce guards in holes
    }
    
    // Give guard a small velocity push in the specified direction
    const body = guard.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocityX(direction * 50); // Small bounce velocity
    
    // Force the guard to change direction using the public method
    guard.forceDirection(direction);
  }
  
  /**
   * Check for collisions between guards and player
   * Extracted from GameScene.checkGuardPlayerCollisions()
   */
  public checkGuardPlayerCollisions(guards: any[], player: any, gameScene: any): void {
    // Check for more robust invincibility system
    const currentTime = this.scene.time.now;
    if (gameScene.playerInvincible && currentTime < gameScene.invincibilityEndTime) {
      return; // Player is invincible
    } else if (gameScene.playerInvincible && currentTime >= gameScene.invincibilityEndTime) {
      // End invincibility period - delegate to GameScene
      gameScene.endPlayerInvincibility();
    }
    
    for (const guard of guards) {
      if (guard.checkPlayerCollision(player.sprite)) {
        gameScene.handlePlayerDeath();
        break; // Only one collision needed
      }
    }
  }
  
  /**
   * Add collision physics to a tile sprite
   * Extracted from GameScene.addTileCollision()
   */
  public addTileCollision(tile: Phaser.GameObjects.Sprite, tileType: number): void {
    // Add collision bodies for different tile types
    switch (tileType) {
      case TILE_TYPES.BRICK: // Brick - solid collision, can be dug
      case TILE_TYPES.SOLID: // Solid block (@) - solid collision, cannot be dug
        this.scene.physics.add.existing(tile, true); // true = static body
        this.solidTiles.add(tile);
        tile.setDepth(GAME_MECHANICS.DEPTHS.TILE_STANDARD); // Standard tile depth
        break;
      
      case TILE_TYPES.LADDER: // Ladder - climbable with platform-style collision (solid from top)
        this.scene.physics.add.existing(tile, true);
        this.ladderTiles.add(tile);
        tile.setDepth(GAME_MECHANICS.DEPTHS.TILE_STANDARD);
        break;
        
      case TILE_TYPES.ROPE: // Rope - hangable, no collision body needed
        // Add to ropeTiles group for position detection (no physics body needed)
        this.ropeTiles.add(tile);
        tile.setDepth(GAME_MECHANICS.DEPTHS.TILE_STANDARD);
        break;
        
    }
  }
  
  /**
   * Remove tile from collision groups  
   * Extracted from GameScene.removeFromCollisionGroups()
   */
  public removeFromCollisionGroups(tile: Phaser.GameObjects.Sprite): void {
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
      this.scene.physics.world.remove(tile.body as Phaser.Physics.Arcade.Body | Phaser.Physics.Arcade.StaticBody);
    }
  }
}