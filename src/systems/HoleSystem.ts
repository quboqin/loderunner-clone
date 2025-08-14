/**
 * HoleSystem - Manages hole digging, filling, and related game mechanics
 * Extracted from GameScene monolith to improve maintainability and testability
 * Implements timeline-based hole mechanics with guard interaction rules
 */
import { BaseSystem } from './BaseSystem';
import { GameScene } from '@/scenes/GameScene';
import { Player } from '@/entities/Player';
import { Guard, GuardState } from '@/entities/Guard';
import { HoleTimeline } from '@/utils/HoleTimeline';
import { AssetManager } from '@/managers/AssetManager';
import { GAME_CONFIG, GAME_MECHANICS, TILE_TYPES } from '@/config/GameConfig';
import { HoleData } from '@/types/GameTypes';

export class HoleSystem extends BaseSystem {
  private holes: Map<string, HoleData> = new Map();
  private holeTimeline: HoleTimeline;
  private gameScene: GameScene;
  
  constructor(scene: GameScene) {
    super(scene);
    this.gameScene = scene;
    this.holeTimeline = new HoleTimeline();
  }
  
  protected initialize(): void {
    this.logger.debug('HoleSystem initialized');
  }
  
  public update(time: number, _delta: number): void {
    // Update hole timeline processing
    this.holeTimeline.update(time);
    
    // Process hole-related game logic
    this.processHoleTimelines(time);
  }
  
  public cleanup(): void {
    // Clean up all active holes and their timers
    this.holes.forEach((holeData) => {
      if (holeData.regenerationTimer) {
        holeData.regenerationTimer.destroy();
      }
      if (holeData.sprite) {
        holeData.sprite.destroy();
      }
    });
    
    this.holes.clear();
    this.logger.debug('HoleSystem cleaned up');
  }
  
  public getSystemName(): string {
    return 'HoleSystem';
  }
  
  public isActive(): boolean {
    return this.holes.size > 0 || this.holeTimeline.getAllActiveTimelines().size > 0;
  }
  
  /**
   * Get the holes map for external access (e.g., collision detection)
   */
  public getHoles(): Map<string, HoleData> {
    return this.holes;
  }
  
  /**
   * Get the hole timeline for external access
   */
  public getHoleTimeline(): HoleTimeline {
    return this.holeTimeline;
  }
  
  /**
   * Check if there's a hole at the specified grid position
   */
  public hasHole(gridX: number, gridY: number): boolean {
    const holeKey = `${gridX},${gridY}`;
    return this.holes.has(holeKey);
  }
  
  /**
   * Get hole data at the specified grid position
   */
  public getHole(gridX: number, gridY: number): HoleData | undefined {
    const holeKey = `${gridX},${gridY}`;
    return this.holes.get(holeKey);
  }
  
  // === METHODS TO BE EXTRACTED FROM GAMESCENE ===
  // These will be moved incrementally from GameScene
  
  /**
   * Process hole timeline events and guard death checks
   * Extracted from GameScene.updateGuardBehaviors()
   */
  private processHoleTimelines(_currentTime: number): void {
    // Implementation will be moved from GameScene
    // TODO: Extract timeline processing logic
  }
  
  /**
   * Dig a hole in the specified direction from player position  
   * Extracted from GameScene.digHole()
   */
  public digHole(direction: 'left' | 'right'): void {
    const player = this.gameScene.getPlayer();
    if (!player) {
      return;
    }
    
    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body;
    const playerGridX = Math.floor(player.sprite.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(player.sprite.y / GAME_CONFIG.tileSize);
    
    // Calculate target hole position based on direction
    let targetX = playerGridX + (direction === 'left' ? -1 : 1);
    let targetY = playerGridY + 1; // Dig one tile below and to the side
    
    // Check if player is on solid ground (can't dig while falling)  
    const climbingState = player.getClimbingState();
    if (!playerBody.onFloor() && !climbingState.onLadder) {
      return; // Can't dig while in mid-air
    }
    
    // Check if target position is valid and diggable
    if (!this.canDigAtPosition(targetX, targetY)) {
      return; // Can't dig here
    }
    
    // Create the hole
    this.createHole(targetX, targetY, direction);
    // Player entity handles its own dig animation and SFX
  }
  
  /**
   * Check if a hole can be dug at the specified position
   * Extracted from GameScene.canDigAtPosition()
   */
  private canDigAtPosition(gridX: number, gridY: number): boolean {
    // Check bounds
    if (
      gridX < 0 || gridX >= GAME_CONFIG.levelWidth ||
      gridY < 0 || gridY >= GAME_CONFIG.levelHeight
    ) {
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
    const tile = this.gameScene.getLevelTiles().get(tileKey);
    
    if (!tile) {
      return false; // No tile to dig
    }
    
    const tileType = tile.getData('tileType');
    
    // Only brick tiles (type 1) can be dug
    // Solid blocks (type 2 and type 5) cannot be dug
    return tileType === TILE_TYPES.BRICK;
  }
  
  /**
   * Create a hole at the specified grid position
   * Extracted from GameScene.createHole()
   */
  public createHole(gridX: number, gridY: number, direction: 'left' | 'right'): void {
    const currentTime = this.scene.time.now;
    const holeKey = `${gridX},${gridY}`;
    const pixelX = gridX * GAME_CONFIG.tileSize + GAME_CONFIG.halfTileSize;
    const pixelY = gridY * GAME_CONFIG.tileSize + GAME_CONFIG.halfTileSize;
    
    // Get the original tile
    const tileKey = `${gridX},${gridY}`;
    const originalTile = this.gameScene.getLevelTiles().get(tileKey);
    
    if (!originalTile) {
      return;
    }
    
    // CRITICAL FIX: Save tile data BEFORE destroying the tile
    const originalTileType = originalTile.getData('tileType');
    
    // In classic Lode Runner, when digging a hole, we need to preserve any
    // non-diggable background elements (ropes, ladders) that exist at this position
    // These should remain visible and functional even with a hole above them
    
    // Create hole sprite
    const holeSprite = this.scene.add.sprite(pixelX, pixelY, 'hole', 0);
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
    this.gameScene.getCollisionSystem().removeFromCollisionGroups(originalTile);
    
    // Completely destroy the original tile to prevent visual artifacts
    originalTile.destroy();
    
    // Create hole timeline entry (Rule 1: t1 = creation time, t2 = t1 + n)
    const timeline = this.holeTimeline.createHoleTimeline(holeKey, currentTime, GAME_MECHANICS.HOLE_DURATION);
    
    // Log hole creation
    this.logger.debug(`[HOLE CREATE] Hole ${holeKey} created:
        - Creation time (t1): ${currentTime}
        - Duration (n): ${GAME_MECHANICS.HOLE_DURATION}
        - Close time (t2): ${timeline.t2}`);
    
    // Set up regeneration timer using timeline duration
    const regenerationTimer = this.scene.time.delayedCall(GAME_MECHANICS.HOLE_DURATION, () => {
      // Verify hole still exists before filling
      if (this.holes.has(holeKey)) {
        this.fillHole(gridX, gridY);
      }
    }, undefined, this.scene); // Use scene as context
    
    // Store hole data using the saved tile type
    const holeData: HoleData = {
      gridX,
      gridY,
      sprite: holeSprite,
      originalTileType: originalTileType, // Use saved value instead of accessing destroyed tile
      regenerationTimer,
      isDigging: true
    };
    
    this.holes.set(holeKey, holeData);
    
    // After digging animation completes, set isDigging to false
    holeSprite.once('animationcomplete', (animation: any) => {
      if (animation.key && animation.key.includes('hole-dig')) {
        holeData.isDigging = false;
      }
    });
  }
  
  /**
   * Fill a hole and restore the original tile
   * Extracted from GameScene.fillHole()
   */
  public fillHole(gridX: number, gridY: number): void {
    const holeKey = `${gridX},${gridY}`;
    const holeData = this.holes.get(holeKey);
    
    if (!holeData) {
      return;
    }
    
    // Check if player is trapped in the hole before it fills
    this.gameScene.checkPlayerTrappedInHole(gridX, gridY);
    
    // Check if any guards can escape before hole fills
    this.gameScene.checkGuardEscapeBeforeHoleFills(holeKey);
    
    // IMMEDIATELY restore the tile - no animation delay for synchronized filling
    // This ensures the hole turns into brick at exactly t2
    this.restoreOriginalTile(holeData, holeKey);
    
    // Optional: Play a fill animation on the restored tile for visual effect
    // This doesn't delay the actual tile restoration
  }
  
  /**
   * Restore the original tile after hole fills
   * Extracted from GameScene.restoreOriginalTile()
   */
  private restoreOriginalTile(holeData: HoleData, holeKey: string): void {
    // Instead of hiding/showing, recreate the tile completely
    const pixelX = holeData.gridX * GAME_CONFIG.tileSize + GAME_CONFIG.halfTileSize;
    const pixelY = holeData.gridY * GAME_CONFIG.tileSize + GAME_CONFIG.halfTileSize;
    
    // Clean up hole sprite first
    holeData.sprite.destroy();
    
    // Get the original tile frame
    const frameKey = AssetManager.getTileFrame(holeData.originalTileType);
    
    // Create new tile sprite
    const newTile = this.scene.add.sprite(pixelX, pixelY, 'tiles', frameKey);
    newTile.setScale(1.6);
    newTile.setData('tileType', holeData.originalTileType);
    newTile.setData('gridX', holeData.gridX);
    newTile.setData('gridY', holeData.gridY);
    
    // Update tile reference in levelTiles map
    const tileKey = `${holeData.gridX},${holeData.gridY}`;
    this.gameScene.getLevelTiles().set(tileKey, newTile);
    
    // Add to collision groups via CollisionSystem
    this.gameScene.getCollisionSystem().addTileCollision(newTile, holeData.originalTileType);
    
    // Remove hole data
    this.holes.delete(holeKey);
    
    this.logger.debug(`[HOLE FILL] Hole ${holeKey} filled and tile restored`);
  }
  
  /**
   * Check for hole collisions with player
   * Extracted from GameScene.checkHoleCollisions()
   */
  public checkPlayerHoleCollisions(player: Player): void {
    const playerGridX = Math.floor(player.sprite.x / GAME_CONFIG.tileSize);
    const playerGridY = Math.floor(player.sprite.y / GAME_CONFIG.tileSize);
    const playerBody = player.sprite.body as Phaser.Physics.Arcade.Body;
    
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
      player.sprite.setDepth(1100); // Extra boost when near holes
    } else {
      player.sprite.setDepth(1000); // Normal depth
    }
    
    // Check if player is standing on a hole
    const holeKey = `${playerGridX},${playerGridY}`;
    const hole = this.holes.get(holeKey);
    
    if (hole && !hole.isDigging) {
      // Delegate guard-in-hole checks to GameScene since it manages guards
      if (this.gameScene.hasGuardsInHole(holeKey)) {
        // Rule 8: Check if player is standing on top of guards in hole
        if (this.gameScene.isPlayerOnGuardInHole(holeKey)) {
          this.gameScene.handlePlayerOnGuardPlatform();
          return; // Player is supported by guard platform
        } else {
          // Player near hole with guards but not on top - prevent falling through
          return; // Hole contains guards - act as bridge
        }
      }
      
      // Hole is empty - proceed with normal falling logic
      const climbingState = player.getClimbingState();
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
      // Check if hole below contains any guards - delegate to GameScene
      if (this.gameScene.hasGuardsInHole(belowHoleKey)) {
        // Rule 8: Check if player would be standing on guards in hole below
        if (this.gameScene.wouldPlayerBeOnGuardInHole(belowHoleKey)) {
          // Provide platform support from guards below
          this.gameScene.handlePlayerOnGuardPlatform();
        }
        return; // Guards provide support either way
      }
      
      // Hole below is empty - player should fall through
      const climbingState = player.getClimbingState();
      if (!climbingState.onLadder && !climbingState.onRope) {
        // Enable gravity to make player fall through the hole
        if (playerBody.gravity.y === 0) {
          playerBody.setGravityY(800);
        }
        playerBody.moves = true;
      }
    }
  }
  
  /**
   * Check for hole collisions with guard
   * Extracted from GameScene.checkGuardHoleCollisions()
   */
  public checkGuardHoleCollisions(guard: Guard, currentTime: number): void {
    const guardX = Math.floor(guard.sprite.x / GAME_CONFIG.tileSize);
    const guardY = Math.floor(guard.sprite.y / GAME_CONFIG.tileSize);
    const holeKey = `${guardX},${guardY}`;
    
    // Check if guard is at a hole position
    if (this.holes.has(holeKey)) {
      const holeData = this.holes.get(holeKey)!;
      if (holeData.sprite && holeData.sprite.visible) {
        
        // Don't trap guard if already in hole (prevent duplicate timeline entries)
        if (guard.getState() === GuardState.IN_HOLE || guard.getState() === GuardState.STUNNED_IN_HOLE) {
          return;
        }
        
        // Simplified logic: Any guard that falls into a visible hole should be trapped
        // This matches classic Lode Runner behavior more closely
        const guardBody = guard.sprite.body as Phaser.Physics.Arcade.Body;
        const isFalling = guardBody.velocity.y > 0; // Falling down
        const isNearHoleCenter = Math.abs(guard.sprite.x - (holeData.gridX * GAME_CONFIG.tileSize + GAME_CONFIG.halfTileSize)) < GAME_CONFIG.halfTileSize; // Within hole bounds
        
        if (isFalling && isNearHoleCenter) {
          this.logger.debug(`[HOLE FALL] Guard ${guard.getGuardId()} falling into hole ${holeKey} at time ${currentTime}`);
          
          // Check if hole has timeline entry (should exist from hole creation)
          const holeTimeline = this.holeTimeline.getHoleTimeline(holeKey);
          if (!holeTimeline) {
            this.logger.warn(`[HOLE FALL ERROR] No timeline for hole ${holeKey} - creating fallback`);
            // Create timeline for this hole if missing (fallback)
            this.holeTimeline.createHoleTimeline(holeKey, currentTime - 1000, GAME_MECHANICS.HOLE_DURATION);
          }
          
          // Use timeline-based hole falling system
          guard.fallIntoHole(holeKey, currentTime);
          
          // Add guard to hole timeline tracking
          this.holeTimeline.addGuardToHole(
            holeKey,
            guard.getGuardId(),
            currentTime,
            GAME_MECHANICS.GUARD_STUN_DURATION
          );
          
          // Debug: Log the timeline calculation for Rule 7
          const shouldDie = this.holeTimeline.shouldGuardDie(holeKey, guard.getGuardId(), GAME_MECHANICS.GUARD_STUN_DURATION);
          this.logger.debug(`[TIMELINE] Guard ${guard.getGuardId()} timeline: shouldDie=${shouldDie}`);
        }
      }
    }
  }
}