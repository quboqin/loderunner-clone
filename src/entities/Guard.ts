import { BaseEntity, EntityConfig, EntityType, PhysicsConfig } from './BaseEntity';
import { LogCategory } from '@/utils/Logger';

export enum GuardState {
  IDLE = 'idle',
  RUNNING_LEFT = 'running_left', 
  RUNNING_RIGHT = 'running_right',
  CLIMBING = 'climbing',
  BAR_LEFT = 'bar_left',
  BAR_RIGHT = 'bar_right',
  FALLING = 'falling',
  IN_HOLE = 'in_hole',
  ESCAPING_HOLE = 'escaping_hole',
  REBORN = 'reborn',
  SHAKING = 'shaking'
}

export class Guard extends BaseEntity {
  protected state: GuardState = GuardState.IDLE;
  private targetPlayer: Phaser.GameObjects.Sprite;
  private lastDirection: number = 1; // 1 for right, -1 for left
  private speed: number = 80;
  
  // Guard-specific properties (spawn position now handled by BaseEntity)
  
  // AI decision timing
  private decisionTimer: number = 0;
  private decisionInterval: number = 500; // Make decision every 500ms
  
  // Hole mechanics
  private holeTimer: number = 0;
  private holeEscapeTime: number = 8000; // 8 seconds in hole before escaping (hole fills at 5s, so guards usually climb out when hole fills)
  private currentHole: string | null = null;
  
  // Pathfinding
  private pathfindingCooldown: number = 0;
  
  // Climbing state
  private onLadder: boolean = false;
  private onRope: boolean = false;
  
  constructor(scene: Phaser.Scene, x: number, y: number, targetPlayer: Phaser.GameObjects.Sprite) {
    const config: EntityConfig = {
      scene,
      x,
      y,
      texture: 'guard',
      frame: 'guard_00',
      scale: 1.6,
      depth: 1000
    };
    
    super(config, EntityType.GUARD, LogCategory.GUARD_AI);
    
    this.targetPlayer = targetPlayer;
    this.setState(GuardState.IDLE);
  }
  
  protected initializeEntity(): void {
    // Set up Guard-specific physics
    const physicsConfig: PhysicsConfig = {
      width: 16,
      height: 28,
      offsetX: 2,
      offsetY: -6,
      gravityY: 600,
      bounce: 0.1,
      collideWorldBounds: true
    };
    
    this.initializePhysics(physicsConfig);
  }
  
  public update(_time: number, delta: number): void {
    this.decisionTimer += delta;
    this.pathfindingCooldown -= delta;
    
    // Debug: Check if guard is near world boundaries (only log when actually at boundary)
    if (this.sprite.x > 890 || this.sprite.x < 10 || this.sprite.y > 500 || this.sprite.y < 10) {
      this.logger.debug(`Guard at boundary: pos(${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`);
    }
    
    // Handle hole mechanics
    if (this.state === GuardState.IN_HOLE) {
      this.holeTimer += delta;
      if (this.holeTimer >= this.holeEscapeTime) {
        this.logger.debug(`Guard auto-escaping after ${(this.holeTimer / 1000).toFixed(1)}s in hole`);
        this.escapeFromHole();
      }
      return; // Don't do other AI while in hole
    }
    
    // Don't do AI while escaping from hole
    if (this.state === GuardState.ESCAPING_HOLE) {
      return;
    }
    
    // Make AI decisions periodically
    if (this.decisionTimer >= this.decisionInterval) {
      this.makeAIDecision();
      this.decisionTimer = 0;
    }
    
    // Execute current behavior
    this.executeBehavior();
    
    // Update animations based on movement
    this.updateAnimation();
    
    // Reset ladder/rope flags at END of frame - they get set by overlap callbacks during this frame
    this.onLadder = false;
    this.onRope = false;
  }
  
  private makeAIDecision(): void {
    if (this.state === GuardState.IN_HOLE || this.state === GuardState.REBORN || this.state === GuardState.ESCAPING_HOLE) {
      return; // Don't make decisions in these states
    }
    
    const playerX = this.targetPlayer.x;
    const playerY = this.targetPlayer.y;
    const guardX = this.sprite.x;
    const guardY = this.sprite.y;
    
    const deltaX = playerX - guardX;
    const deltaY = playerY - guardY;
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    // Priority 1: If already running and making progress, KEEP RUNNING (don't get distracted by ladders)
    if ((this.state === GuardState.RUNNING_LEFT || this.state === GuardState.RUNNING_RIGHT) && 
        Math.abs(deltaX) > 20) {
      // Continue current horizontal movement if not blocked
      if (this.state === GuardState.RUNNING_LEFT && !body.blocked.left) {
        return; // Keep running left
      }
      if (this.state === GuardState.RUNNING_RIGHT && !body.blocked.right) {
        return; // Keep running right  
      }
    }
    
    // Priority 2: Vertical movement when player is on significantly different level
    if (Math.abs(deltaY) > 45) { // Reduced from 60 to be more aggressive
      // Player is on a very different level - prioritize vertical movement
      if (this.canClimb()) {
        this.logger.debug(`Guard climbing toward player: deltaY=${deltaY.toFixed(0)}, deltaX=${deltaX.toFixed(0)}`);
        this.setState(GuardState.CLIMBING);
        return;
      }
      
      if (this.canUseRope()) {
        this.logger.debug(`Guard using rope toward player: deltaY=${deltaY.toFixed(0)}, deltaX=${deltaX.toFixed(0)}`);
        this.setState(deltaX > 0 ? GuardState.BAR_RIGHT : GuardState.BAR_LEFT);
        this.lastDirection = deltaX > 0 ? 1 : -1;
        return;
      }
      
      // Player is on different level but no ladder/rope available - move to find one
      this.logger.debug(`Player on different level (deltaY=${deltaY.toFixed(0)}) but guard not on ladder/rope - seeking`);
      
      // Actively seek ladders/ropes by moving horizontally
      // If player is significantly to the left/right, move toward them to find connections
      if (Math.abs(deltaX) > 32) { // More than one tile away horizontally
        const seekDirection = deltaX > 0 ? GuardState.RUNNING_RIGHT : GuardState.RUNNING_LEFT;
        const seekBlocked = deltaX > 0 ? body.blocked.right : body.blocked.left;
        
        if (!seekBlocked) {
          this.logger.debug(`Guard seeking ladder - moving ${deltaX > 0 ? 'right' : 'left'} toward player`);
          this.setState(seekDirection);
          this.lastDirection = deltaX > 0 ? 1 : -1;
          return;
        } else {
          this.logger.debug('Guard blocked while seeking ladder - trying alternate direction');
        }
      }
      
      // If can't move toward player, try moving in either direction to find ladders
      if (!body.blocked.left && Math.random() > 0.5) {
        this.logger.debug('Guard exploring left to find ladders');
        this.setState(GuardState.RUNNING_LEFT);
        this.lastDirection = -1;
        return;
      } else if (!body.blocked.right) {
        this.logger.debug('Guard exploring right to find ladders');
        this.setState(GuardState.RUNNING_RIGHT);
        this.lastDirection = 1;
        return;
      }
    }

    // Priority 3: Horizontal movement towards player 
    if (Math.abs(deltaX) > 20) {
      const targetDirection = deltaX > 0 ? GuardState.RUNNING_RIGHT : GuardState.RUNNING_LEFT;
      const isBlocked = deltaX > 0 ? body.blocked.right : body.blocked.left;
      
      if (!isBlocked) {
        // Not blocked, run horizontally
        this.setState(targetDirection);
        this.lastDirection = deltaX > 0 ? 1 : -1;
        return;
      }
      
      // Blocked horizontally, now consider vertical movement as backup
      if (Math.abs(deltaY) > 40) {
        // Try to climb if on ladder
        if (this.canClimb()) {
          this.setState(GuardState.CLIMBING);
          return;
        }
        
        // Try to use rope if available
        if (this.canUseRope()) {
          this.setState(deltaX > 0 ? GuardState.BAR_RIGHT : GuardState.BAR_LEFT);
          this.lastDirection = deltaX > 0 ? 1 : -1;
          return;
        }
      }
      
      // Can't move toward player, reverse direction
      this.setState(deltaX > 0 ? GuardState.RUNNING_LEFT : GuardState.RUNNING_RIGHT);
      this.lastDirection = deltaX > 0 ? -1 : 1;
      return;
    }
    
    // Priority 4: Player on different vertical level - seek ladders/ropes
    if (Math.abs(deltaY) > 40) {
      // If on ladder, climb toward player
      if (this.canClimb()) {
        this.setState(GuardState.CLIMBING);
        return;
      }
      
      // If on rope, use it to move toward player
      if (this.canUseRope()) {
        this.setState(deltaX > 0 ? GuardState.BAR_RIGHT : GuardState.BAR_LEFT);
        this.lastDirection = deltaX > 0 ? 1 : -1;
        return;
      }
      
      // Not on ladder/rope but player is on different level - move horizontally to find one
      if (Math.abs(deltaX) < 100) { // Within reasonable horizontal distance
        // Move toward player's general direction
        const targetDirection = deltaX > 0 ? GuardState.RUNNING_RIGHT : GuardState.RUNNING_LEFT;
        this.setState(targetDirection);
        this.lastDirection = deltaX > 0 ? 1 : -1;
        return;
      }
    }
    
    // Default: idle
    this.setState(GuardState.IDLE);
  }
  
  private executeBehavior(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    switch (this.state) {
      case GuardState.IDLE:
        body.setVelocityX(0);
        break;
        
      case GuardState.RUNNING_LEFT:
        // Check if blocked by wall, if so, try to find alternative path
        if (body.blocked.left) {
          // Only climb if player is significantly above/below us
          const playerY = this.targetPlayer.y;
          const guardY = this.sprite.y;
          const deltaY = playerY - guardY;
          
          if (this.onLadder && Math.abs(deltaY) > 15) {
            this.setState(GuardState.CLIMBING);
            return;
          }
          // Otherwise, reverse direction temporarily
          this.setState(GuardState.RUNNING_RIGHT);
          return;
        }
        body.setVelocityX(-this.speed);
        break;
        
      case GuardState.RUNNING_RIGHT:
        
        // Check if blocked by wall, if so, try to find alternative path
        if (body.blocked.right) {
          // Only climb if player is significantly above/below us
          const playerY = this.targetPlayer.y;
          const guardY = this.sprite.y;
          const deltaY = playerY - guardY;
          
          if (this.onLadder && Math.abs(deltaY) > 15) {
            this.setState(GuardState.CLIMBING);
            return;
          }
          // Otherwise, reverse direction temporarily
          this.setState(GuardState.RUNNING_LEFT);
          return;
        }
        body.setVelocityX(this.speed);
        break;
        
      case GuardState.CLIMBING:
        // Set climbing velocity based on player position
        const playerY = this.targetPlayer.y;
        const guardY = this.sprite.y;
        const deltaY = playerY - guardY;
        const guardX = this.sprite.x;
        
        body.setVelocityX(0); // No horizontal movement while climbing
        
        // Ensure guard stays centered on ladder during climbing
        const currentTileX = Math.floor(this.sprite.x / 32);
        const ladderCenterX = (currentTileX * 32) + 16;
        if (Math.abs(this.sprite.x - ladderCenterX) > 2) { // Only adjust if drift is significant
          this.sprite.setX(ladderCenterX);
        }
        
        if (this.canClimb()) {
          // Disable gravity while climbing to prevent falling through ladder
          body.setGravityY(0);
          
          // Continue climbing towards player
          if (Math.abs(deltaY) > 20) { // Still need to climb
            const climbSpeed = 60;
            if (deltaY < 0) {
              body.setVelocityY(-climbSpeed); // Climb up
            } else {
              body.setVelocityY(climbSpeed); // Climb down
            }
          } else {
            // Close to player level, transition to horizontal movement
            body.setVelocityY(0);
            body.setGravityY(600); // Restore gravity for normal movement
            
            // Decide horizontal direction based on player position
            const deltaX = this.targetPlayer.x - guardX;
            if (Math.abs(deltaX) > 20) {
              if (deltaX > 0) {
                this.setState(GuardState.RUNNING_RIGHT);
                this.lastDirection = 1;
              } else {
                this.setState(GuardState.RUNNING_LEFT);
                this.lastDirection = -1;
              }
            } else {
              this.setState(GuardState.IDLE);
            }
          }
        } else {
          // No longer on ladder, restore gravity and handle falling
          body.setGravityY(600);
          body.setVelocityY(0);
          if (body.blocked.down || body.touching.down) {
            // On ground, resume normal AI
            this.setState(GuardState.IDLE);
          } else {
            // In air, fall
            this.setState(GuardState.FALLING);
          }
        }
        break;
        
      case GuardState.BAR_LEFT:
        if (this.canUseRope()) {
          body.setVelocityX(-this.speed);
          body.setVelocityY(0); // Stay at rope level
          // Check if should stop rope movement
          const deltaX = this.targetPlayer.x - this.sprite.x;
          if (Math.abs(deltaX) < 20) {
            // Close to player horizontally, try vertical movement or stop
            const deltaY = this.targetPlayer.y - this.sprite.y;
            if (Math.abs(deltaY) > 40) {
              // Player on different level, drop down
              this.setState(GuardState.FALLING);
            } else {
              this.setState(GuardState.IDLE);
            }
          }
        } else {
          // No longer on rope, fall
          this.setState(GuardState.FALLING);
        }
        break;
        
      case GuardState.BAR_RIGHT:
        if (this.canUseRope()) {
          body.setVelocityX(this.speed);
          body.setVelocityY(0); // Stay at rope level
          // Check if should stop rope movement
          const deltaX = this.targetPlayer.x - this.sprite.x;
          if (Math.abs(deltaX) < 20) {
            // Close to player horizontally, try vertical movement or stop
            const deltaY = this.targetPlayer.y - this.sprite.y;
            if (Math.abs(deltaY) > 40) {
              // Player on different level, drop down
              this.setState(GuardState.FALLING);
            } else {
              this.setState(GuardState.IDLE);
            }
          }
        } else {
          // No longer on rope, fall
          this.setState(GuardState.FALLING);
        }
        break;
        
      case GuardState.FALLING:
        // Let physics handle falling
        if (body.blocked.down || body.touching.down) {
          this.setState(GuardState.IDLE);
        }
        break;
        
      case GuardState.IN_HOLE:
        body.setVelocity(0, 0);
        break;
        
      case GuardState.ESCAPING_HOLE:
        // Maintain upward velocity while escaping - movement handled by executeHoleEscapeClimb()
        body.setVelocityX(0); // No horizontal movement while climbing out
        break;
    }
  }
  
  private updateAnimation(): void {
    switch (this.state) {
      case GuardState.IDLE:
        this.sprite.anims.play('guard-idle', true);
        break;
        
      case GuardState.RUNNING_LEFT:
        this.sprite.anims.play('guard-run-left', true);
        break;
        
      case GuardState.RUNNING_RIGHT:
        this.sprite.anims.play('guard-run-right', true);
        break;
        
      case GuardState.CLIMBING:
        this.sprite.anims.play('guard-climb', true);
        break;
        
      case GuardState.BAR_LEFT:
        this.sprite.anims.play('guard-bar-left', true);
        break;
        
      case GuardState.BAR_RIGHT:
        this.sprite.anims.play('guard-bar-right', true);
        break;
        
      case GuardState.FALLING:
        if (this.lastDirection > 0) {
          this.sprite.anims.play('guard-fall-right', true);
        } else {
          this.sprite.anims.play('guard-fall-left', true);
        }
        break;
        
      case GuardState.IN_HOLE:
        if (this.lastDirection > 0) {
          this.sprite.anims.play('guard-shake-right', true);
        } else {
          this.sprite.anims.play('guard-shake-left', true);
        }
        break;
        
      case GuardState.ESCAPING_HOLE:
        this.sprite.anims.play('guard-climb', true);
        break;
        
      case GuardState.REBORN:
        this.sprite.anims.play('guard-reborn', true);
        break;
    }
  }
  
  protected setState(newState: GuardState): void {
    if (this.state !== newState) {
      // Handle physics changes when entering/leaving climbing state
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      
      if (newState === GuardState.CLIMBING) {
        // Entering climbing state - prepare physics for ladder climbing
        body.setGravityY(0); // Disable gravity while climbing
        
        // Snap to ladder center X position for proper climbing
        this.snapToLadderCenter();
      } else if (this.state === GuardState.CLIMBING) {
        // Leaving climbing state - restore normal physics
        body.setGravityY(600); // Restore gravity
      }
    }
    this.state = newState;
  }
  
  public getState(): GuardState {
    return this.state;
  }

  // Force guard to change direction (used for guard-to-guard collision)
  public forceDirection(direction: number): void {
    // Only change direction if not in special states
    if (this.state !== GuardState.IN_HOLE && this.state !== GuardState.REBORN && 
        this.state !== GuardState.CLIMBING && this.state !== GuardState.ESCAPING_HOLE) {
      this.lastDirection = direction;
      if (direction > 0) {
        this.setState(GuardState.RUNNING_RIGHT);
      } else {
        this.setState(GuardState.RUNNING_LEFT);
      }
    }
  }
  
  // Check if this guard can be stepped on by other guards for climbing out of holes
  public canBeSteppedOn(): boolean {
    return this.state === GuardState.IN_HOLE;
  }
  
  // Help another guard climb out by providing a stepping platform
  public helpGuardClimb(otherGuard: Guard): void {
    if (this.state === GuardState.IN_HOLE && otherGuard.state === GuardState.IN_HOLE) {
      // If both guards are in the same hole, the other guard can climb on this one
      const guardDistance = Phaser.Geom.Point.Distance(
        { x: this.sprite.x, y: this.sprite.y },
        { x: otherGuard.sprite.x, y: otherGuard.sprite.y }
      );
      
      if (guardDistance < 20) { // Close enough to help
        this.logger.debug('Guard helping other guard climb out of hole');
        otherGuard.executeAssistedClimb();
      }
    }
  }
  
  // Execute climb out with help from another guard
  private executeAssistedClimb(): void {
    if (this.state === GuardState.IN_HOLE && this.holeTimer < this.holeEscapeTime) {
      this.logger.debug('Guard climbing out with help from another guard');
      this.setState(GuardState.ESCAPING_HOLE);
      this.executeHoleEscapeClimb();
    }
  }
  
  public getCurrentHole(): string | null {
    return this.currentHole;
  }
  
  public setClimbableState(ladder: boolean, rope: boolean): void {
    this.onLadder = ladder;
    this.onRope = rope;
  }
  
  // Check if guard can climb (on ladder)
  public canClimb(): boolean {
    return this.onLadder;
  }
  
  // Check if guard can use rope
  public canUseRope(): boolean {
    return this.onRope;
  }

  // Snap guard to center X position of the ladder tile for proper climbing
  private snapToLadderCenter(): void {
    // Calculate which tile the guard is currently on
    const currentTileX = Math.floor(this.sprite.x / 32);
    
    // Calculate the center X position of this tile
    const ladderCenterX = (currentTileX * 32) + 16; // Tile center is at tile coordinate * 32 + 16
    
    // Snap guard to ladder center X position
    this.sprite.setX(ladderCenterX);
  }
  
  
  // Handle falling into hole
  public fallIntoHole(holeKey: string): void {
    // Don't trap guard if already in a hole
    if (this.state === GuardState.IN_HOLE) {
      return;
    }
    
    this.setState(GuardState.IN_HOLE);
    this.currentHole = holeKey;
    this.holeTimer = 0;
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // No gravity while in hole
  }
  
  // Handle escaping from hole
  private escapeFromHole(): void {
    if (!this.currentHole) return;
    
    this.logger.debug('Guard automatically escaping from hole due to timer');
    this.setState(GuardState.ESCAPING_HOLE);
    
    // Start climbing animation - guard will climb out over 0.5 seconds
    this.executeHoleEscapeClimb();
  }
  
  // Check if guard can escape from hole (called when hole is about to fill)
  public attemptHoleEscape(): boolean {
    if (this.state !== GuardState.IN_HOLE) {
      return true; // Not in hole, so no problem
    }
    
    // Guard has been in hole for less than the escape time - can escape
    if (this.holeTimer < this.holeEscapeTime) {
      this.logger.debug(`Guard climbing out of hole after ${(this.holeTimer / 1000).toFixed(1)}s`);
      this.setState(GuardState.ESCAPING_HOLE);
      
      // Start climbing animation - guard will climb out over 0.5 seconds
      this.executeHoleEscapeClimb();
      
      return true; // Successfully escaping
    }
    
    // Guard trapped too long - will be killed and respawn
    this.logger.debug(`Guard trapped in hole for ${(this.holeTimer / 1000).toFixed(1)}s - triggering respawn`);
    
    // Trigger respawn immediately 
    this.respawnAtStart();
    
    return false; // Cannot escape, was trapped but now respawned
  }
  
  // Execute climbing out of hole animation and movement
  private executeHoleEscapeClimb(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    // Set upward velocity to climb out
    body.setVelocityY(-120); // Climb up speed
    body.setVelocityX(0);    // No horizontal movement while climbing
    body.setGravityY(0);     // No gravity while climbing out
    
    // Use climbing animation
    this.sprite.anims.play('guard-climb', true);
    
    // After 0.5 seconds, complete the escape
    this.scene.time.delayedCall(500, () => {
      this.completeHoleEscape();
    });
  }
  
  // Complete the hole escape - restore normal state
  private completeHoleEscape(): void {
    this.logger.debug('Guard successfully climbed out of hole');
    
    // Clear hole state
    this.currentHole = null;
    this.holeTimer = 0;
    
    // Restore normal physics
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(600);
    body.setVelocityY(0);
    
    // Return to normal state
    this.setState(GuardState.IDLE);
  }
  
  // Respawn guard at starting position
  private respawnAtStart(): void {
    this.logger.debug(`Guard killed in hole, respawning at spawn position (${this.spawnPosition.x}, ${this.spawnPosition.y})`);
    
    // Move guard back to spawn position
    this.sprite.setPosition(this.spawnPosition.x, this.spawnPosition.y);
    
    // Reset physics immediately
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(600);
    body.setVelocity(0, 0);
    
    // Reset timers and state
    this.holeTimer = 0;
    this.currentHole = null;
    
    // Set reborn state with visual effect
    this.setState(GuardState.REBORN);
    this.sprite.setAlpha(0.5); // Semi-transparent during reborn
    
    // Fade in effect
    this.scene.tweens.add({
      targets: this.sprite,
      alpha: 1.0,
      duration: 1000,
      ease: 'Power2'
    });
    
    // After a brief delay, return to normal operation
    (this.scene as Phaser.Scene).time.delayedCall(1500, () => {
      this.setState(GuardState.IDLE);
    });
  }
  
  // Check collision with player - only catch if on same horizontal plane
  public checkPlayerCollision(player: Phaser.GameObjects.Sprite): boolean {
    if (this.state === GuardState.REBORN || 
        this.state === GuardState.ESCAPING_HOLE ||
        this.state === GuardState.IN_HOLE) {
      return false; // Can't collide when respawning, escaping from hole, or in hole
    }
    
    const guardBounds = this.sprite.getBounds();
    const playerBounds = player.getBounds();
    
    // First check if there's any spatial overlap
    const hasOverlap = Phaser.Geom.Rectangle.Overlaps(guardBounds, playerBounds);
    if (!hasOverlap) {
      return false; // No overlap at all
    }
    
    // Calculate center positions for horizontal plane checking
    const guardCenterY = this.sprite.y;
    const playerCenterY = player.y;
    const verticalDistance = Math.abs(guardCenterY - playerCenterY);
    
    // Define horizontal plane tolerance - if vertical distance is too large, they're on different planes
    const horizontalPlaneTolerance = 20; // Approximately half a tile height
    
    if (verticalDistance > horizontalPlaneTolerance) {
      // Player and guard are on different horizontal planes
      // Player can safely step on guard's head or pass underneath
      return false; // Safe passage - no collision
    }
    
    // They are on the same horizontal plane - collision should trigger
    return true;
  }
  
  // Set collision detection callbacks (to be called from GameScene)
  public setCollisionCallbacks(
    ladderGroup: Phaser.Physics.Arcade.StaticGroup,
    ropeGroup: Phaser.Physics.Arcade.StaticGroup,
    solidGroup: Phaser.Physics.Arcade.StaticGroup
  ): void {
    // Set up collision with solid tiles, but EXCLUDE ladder tiles from collision
    this.scene.physics.add.collider(this.sprite, solidGroup, undefined, (_guard: any, tile: any) => {
      // Check if this tile is also a ladder - if so, allow pass-through
      const isLadder = ladderGroup.children.entries.includes(tile);
      if (isLadder) {
        return false; // Don't collide with ladders - allow pass-through
      }
      return true; // Normal collision for non-ladder solid tiles
    }, this.scene);
    
    // Set up overlap detection for ladders and ropes
    this.scene.physics.add.overlap(this.sprite, ladderGroup, this.onLadderOverlap, undefined, this.scene);
    this.scene.physics.add.overlap(this.sprite, ropeGroup, this.onRopeOverlap, undefined, this.scene);
  }
  
  private onLadderOverlap = (): void => {
    this.onLadder = true;
  }
  
  private onRopeOverlap = (): void => {
    this.onRope = true;
  }
  
  
  
  public reset(): void {
    // Reset all guard state to initial values
    this.setState(GuardState.IDLE);
    this.lastDirection = 1;
    this.decisionTimer = 0;
    this.pathfindingCooldown = 0;
    this.holeTimer = 0;
    this.currentHole = null;
    this.onLadder = false;
    this.onRope = false;
    
    // Reset physics body
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(600);
    
    // Reset sprite appearance
    this.sprite.setAlpha(1.0);
    
    // Force immediate AI decision on next update
    this.decisionTimer = this.decisionInterval; // This will trigger AI decision on next update
  }

  public destroy(): void {
    // Call parent destroy method to handle common cleanup
    super.destroy();
  }
}