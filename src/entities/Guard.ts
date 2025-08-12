import { BaseEntity, EntityConfig, EntityType, PhysicsConfig } from './BaseEntity';
import { LogCategory } from '@/utils/Logger';
import { GAME_MECHANICS } from '@/config/GameConfig';

export enum GuardState {
  IDLE = 'idle',
  RUNNING_LEFT = 'running_left', 
  RUNNING_RIGHT = 'running_right',
  CLIMBING = 'climbing',
  BAR_LEFT = 'bar_left',
  BAR_RIGHT = 'bar_right',
  FALLING = 'falling',
  IN_HOLE = 'in_hole',
  STUNNED_IN_HOLE = 'stunned_in_hole', // New state for mandatory stun period
  ESCAPING_HOLE = 'escaping_hole',
  REBORN = 'reborn',
  SHAKING = 'shaking'
}

export class Guard extends BaseEntity {
  protected state: GuardState = GuardState.IDLE;
  private targetPlayer: Phaser.GameObjects.Sprite;
  private lastDirection: number = 1; // 1 for right, -1 for left
  private speed: number = 80;
  
  // Unique identifier for timeline tracking
  public readonly guardId: string;
  
  // Guard-specific properties (spawn position now handled by BaseEntity)
  
  // AI decision timing
  private decisionTimer: number = 0;
  private decisionInterval: number = 500; // Make decision every 500ms
  
  // Timeline-based hole mechanics (following new rule system)
  private currentHole: string | null = null;
  private fallTime: number = 0; // tg1: Time when guard fell into hole
  private stunEndTime: number = 0; // tg1 + m: When guard can start climbing
  private isStunned: boolean = false; // Whether guard is in mandatory stun period
  
  // Legacy timing (for backward compatibility during transition)
  private holeTimer: number = 0;
  
  // Pathfinding
  private pathfindingCooldown: number = 0;
  
  // Climbing state
  private onLadder: boolean = false;
  private onRope: boolean = false;
  private ladderExitCooldown: number = 0; // Cooldown to prevent immediate ladder re-entry after exiting
  private lastLadderTileX: number = -1; // Track which ladder tile we last exited to prevent re-entry
  
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
    
    // Generate unique guard ID for timeline tracking
    this.guardId = `guard_${x}_${y}_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`;
    
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
  
  public update(time: number, delta: number): void {
    this.decisionTimer += delta;
    this.pathfindingCooldown -= delta;
    
    // Update ladder exit cooldown and reset tracking when expired
    const previousCooldown = this.ladderExitCooldown;
    this.ladderExitCooldown = Math.max(0, this.ladderExitCooldown - delta);
    if (previousCooldown > 0 && this.ladderExitCooldown === 0) {
      this.lastLadderTileX = -1; // Reset ladder tracking when cooldown expires
    }
    
    // Debug: Check if guard is near world boundaries (only log when actually at boundary)
    if (this.sprite.x > 890 || this.sprite.x < 10 || this.sprite.y > 500 || this.sprite.y < 10) {
      this.logger.debug(`Guard at boundary: pos(${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)})`);
    }
    
    // Handle timeline-based hole mechanics
    if (this.state === GuardState.STUNNED_IN_HOLE) {
      this.holeTimer += delta; // Keep legacy timer for compatibility
      
      // Check if stun period has ended
      if (time >= this.stunEndTime) {
        this.logger.debug(`Guard ${this.guardId} stun period ended, transitioning to IN_HOLE state`);
        this.setState(GuardState.IN_HOLE);
        this.isStunned = false;
      }
      return; // Don't do other AI while stunned
    }
    
    if (this.state === GuardState.IN_HOLE) {
      this.holeTimer += delta; // Keep legacy timer for compatibility
      
      // Guard is in hole but no longer stunned - can attempt to climb
      // Timeline-based escape logic will be handled by GameScene via HoleTimeline
      // This preserves the existing escape attempt structure but timeline determines timing
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
      if (this.canClimb() && this.ladderExitCooldown <= 0) { // Check cooldown
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
        // Try to climb if on ladder (check cooldown)
        if (this.canClimb() && this.ladderExitCooldown <= 0) {
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
      // If on ladder, climb toward player (check cooldown)
      if (this.canClimb() && this.ladderExitCooldown <= 0) {
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
          // Only climb if player is significantly above/below us (and cooldown expired)
          const playerY = this.targetPlayer.y;
          const guardY = this.sprite.y;
          const deltaY = playerY - guardY;
          
          if (this.onLadder && Math.abs(deltaY) > 15 && this.ladderExitCooldown <= 0) {
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
          // Only climb if player is significantly above/below us (and cooldown expired)
          const playerY = this.targetPlayer.y;
          const guardY = this.sprite.y;
          const deltaY = playerY - guardY;
          
          if (this.onLadder && Math.abs(deltaY) > 15 && this.ladderExitCooldown <= 0) {
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
          
          // Check if trying to climb down but blocked (at bottom of ladder)
          if (deltaY > 20 && body.blocked.down) {
            // At bottom of ladder, can't climb down further
            this.logger.debug(`Guard at bottom of ladder, exiting to chase player horizontally`);
            
            // Transition to horizontal movement and exit ladder completely
            body.setGravityY(600); // Restore gravity
            body.setVelocityY(0);
            
            const deltaX = this.targetPlayer.x - guardX;
            
            // Determine exit direction
            let exitDirection = 0;
            if (Math.abs(deltaX) > 20) {
              exitDirection = deltaX > 0 ? 1 : -1;
            } else {
              // If player is directly below, exit in last direction or random
              exitDirection = this.lastDirection || (Math.random() > 0.5 ? 1 : -1);
            }
            
            // Move guard completely off the ladder tile to prevent re-climbing
            const exitOffset = 24; // Move far enough to completely exit ladder tile (32px tile - 8px guard margin)
            this.sprite.setX(this.sprite.x + (exitOffset * exitDirection));
            
            // Set running state
            if (exitDirection > 0) {
              this.setState(GuardState.RUNNING_RIGHT);
              this.lastDirection = 1;
            } else {
              this.setState(GuardState.RUNNING_LEFT);
              this.lastDirection = -1;
            }
            
            // Force clear the ladder flag and set cooldown to prevent immediate re-entry
            this.onLadder = false;
            this.ladderExitCooldown = 1500; // Increased to 1.5 seconds to prevent AI re-entry
            this.lastLadderTileX = currentTileX; // Remember which ladder we exited
            
            this.logger.debug(`Guard exited ladder at bottom: pos(${this.sprite.x.toFixed(1)}, ${this.sprite.y.toFixed(1)}), direction=${exitDirection}, cooldown=${this.ladderExitCooldown}, tileX=${currentTileX}`);
            break;
          }
          
          // Continue climbing towards player
          if (Math.abs(deltaY) > 20) { // Still need to climb
            const climbSpeed = 60;
            if (deltaY < 0) {
              body.setVelocityY(-climbSpeed); // Climb up
            } else {
              // Check if we can actually climb down (not at bottom)
              if (!body.blocked.down) {
                body.setVelocityY(climbSpeed); // Climb down
              } else {
                // At bottom, stop climbing
                body.setVelocityY(0);
              }
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
    // Guards can be stepped on when in hole (both stunned and unstunned states)
    return this.state === GuardState.IN_HOLE || this.state === GuardState.STUNNED_IN_HOLE;
  }

  // Rule 8: Check if another entity (Player or Guard) is standing on top of this guard
  public isEntityOnTop(entitySprite: Phaser.GameObjects.Sprite): boolean {
    if (!this.canBeSteppedOn()) {
      return false; // This guard can't be stood on
    }

    const guardBounds = this.sprite.getBounds();
    const entityBounds = entitySprite.getBounds();

    // Check for horizontal overlap (entity must be above this guard)
    const horizontalOverlap = entityBounds.right > guardBounds.left && 
                             entityBounds.left < guardBounds.right;

    if (!horizontalOverlap) {
      return false; // No horizontal overlap
    }

    // Check vertical positioning - entity should be above guard
    // Entity's bottom should be near or on guard's top
    const entityBottom = entityBounds.bottom;
    const guardTop = guardBounds.top;
    const platformTolerance = 8; // Pixels tolerance for "standing on"

    const isOnTop = entityBottom >= guardTop - platformTolerance && 
                   entityBottom <= guardTop + platformTolerance;

    return isOnTop;
  }

  // Rule 8: Get platform collision bounds for entities to stand on
  public getPlatformBounds(): Phaser.Geom.Rectangle | null {
    if (!this.canBeSteppedOn()) {
      return null;
    }

    const guardBounds = this.sprite.getBounds();
    // Platform surface is the top portion of the guard sprite
    return new Phaser.Geom.Rectangle(
      guardBounds.x,
      guardBounds.y,
      guardBounds.width,
      4 // Platform surface height (top 4 pixels of guard)
    );
  }

  // Rule 8: Check if this guard provides platform support at a specific position
  public providesPlatformAt(x: number, y: number): boolean {
    const platformBounds = this.getPlatformBounds();
    if (!platformBounds) {
      return false;
    }

    return platformBounds.contains(x, y);
  }
  
  // Help another guard climb out by providing a stepping platform
  public helpGuardClimb(otherGuard: Guard): void {
    // Guards can help if they're both in holes (any hole state)
    const thisInHole = this.state === GuardState.IN_HOLE || this.state === GuardState.STUNNED_IN_HOLE;
    const otherInHole = otherGuard.state === GuardState.IN_HOLE || otherGuard.state === GuardState.STUNNED_IN_HOLE;
    
    if (thisInHole && otherInHole) {
      // Check if guards are in the same hole (both holeKey and distance check)
      const sameHole = this.currentHole === otherGuard.currentHole && this.currentHole !== null;
      const guardDistance = Phaser.Math.Distance.Between(
        this.sprite.x, this.sprite.y,
        otherGuard.sprite.x, otherGuard.sprite.y
      );
      
      if (sameHole && guardDistance < 25) { // Close enough to help in same hole
        // Rule 8: Check if one guard can stand on the other to climb out
        const thisCanBePlatform = this.canBeSteppedOn();
        const otherCanBePlatform = otherGuard.canBeSteppedOn();
        
        if (thisCanBePlatform && !otherGuard.isStunned) {
          // This guard acts as platform for other guard to climb
          this.logger.debug(`Guard ${this.guardId} providing platform for guard ${otherGuard.guardId} to climb out`);
          otherGuard.executeAssistedClimbWithPlatform(this);
        } else if (otherCanBePlatform && !this.isStunned) {
          // Other guard acts as platform for this guard to climb
          this.logger.debug(`Guard ${otherGuard.guardId} providing platform for guard ${this.guardId} to climb out`);
          this.executeAssistedClimbWithPlatform(otherGuard);
        }
      }
    }
  }
  

  // Rule 8: Execute assisted climb using another guard as a platform
  public executeAssistedClimbWithPlatform(platformGuard: Guard): void {
    // Check if this guard can climb and the platform guard can be stood on
    if (this.state !== GuardState.IN_HOLE || this.isStunned) {
      this.logger.debug(`Guard ${this.guardId} cannot climb - state: ${this.state}, stunned: ${this.isStunned}`);
      return;
    }

    if (!platformGuard.canBeSteppedOn()) {
      this.logger.debug(`Platform guard ${platformGuard.guardId} cannot be stood on - state: ${platformGuard.state}`);
      return;
    }

    // Verify guards are in the same hole
    if (this.currentHole !== platformGuard.currentHole || !this.currentHole) {
      this.logger.debug(`Guards not in same hole - this: ${this.currentHole}, platform: ${platformGuard.currentHole}`);
      return;
    }

    // Calculate relative positions
    const thisGuardBounds = this.sprite.getBounds();
    const platformBounds = platformGuard.getPlatformBounds();
    
    if (!platformBounds) {
      this.logger.debug(`Platform guard ${platformGuard.guardId} has no valid platform bounds`);
      return;
    }

    // Check if this guard can reach the platform guard
    const horizontalDistance = Math.abs(this.sprite.x - platformGuard.sprite.x);
    const verticalDistance = Math.abs(this.sprite.y - platformGuard.sprite.y);

    if (horizontalDistance > 24 || verticalDistance > 20) { // Within one tile range
      this.logger.debug(`Guards too far apart for platform assistance - hDist: ${horizontalDistance}, vDist: ${verticalDistance}`);
      return;
    }

    this.logger.debug(`Guard ${this.guardId} starting platform-assisted climb using guard ${platformGuard.guardId}`);

    // Position this guard on top of the platform guard
    const platformTop = platformBounds.y;
    const thisGuardHeight = thisGuardBounds.height;
    
    // Set this guard's position to stand on the platform
    this.sprite.setY(platformTop - thisGuardHeight / 2);
    this.sprite.setX(platformGuard.sprite.x); // Align horizontally

    // Modify physics for platform standing
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // No gravity while on platform

    // Start the platform climb sequence
    this.setState(GuardState.ESCAPING_HOLE);
    
    // Execute climb with platform mechanics
    this.executePlatformAssistedEscape(platformGuard);
  }

  // Execute the actual platform-assisted escape sequence
  private executePlatformAssistedEscape(platformGuard: Guard): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    this.logger.debug(`Guard ${this.guardId} executing platform-assisted escape using ${platformGuard.guardId}`);

    // Phase 1: Stand on platform guard (brief pause)
    body.setVelocity(0, 0);
    
    this.scene.time.delayedCall(300, () => {
      // Phase 2: Climb up from platform position
      this.logger.debug(`Guard ${this.guardId} climbing up from platform position`);
      
      // Set upward velocity to climb out
      body.setVelocityY(-100); // Faster climb with platform assistance
      body.setVelocityX(0);
      body.setGravityY(0); // Maintain no gravity during climb
      
      // Use climbing animation
      this.sprite.anims.play('guard-climb', true);
      
      // Complete the escape after climbing duration
      this.scene.time.delayedCall(800, () => {
        this.completePlatformAssistedEscape();
      });
    });
  }

  // Complete the platform-assisted escape
  private completePlatformAssistedEscape(): void {
    this.logger.debug(`Guard ${this.guardId} successfully completed platform-assisted escape`);
    
    // Clear hole state
    this.currentHole = null;
    this.holeTimer = 0;
    this.fallTime = 0;
    this.stunEndTime = 0;
    this.isStunned = false;
    
    // Restore normal physics
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(600);
    body.setVelocityY(0);
    
    // Return to normal state
    this.setState(GuardState.IDLE);
  }
  
  public getCurrentHole(): string | null {
    return this.currentHole;
  }

  // Timeline-based getter methods for new rule system
  public getFallTime(): number {
    return this.fallTime;
  }

  public getStunEndTime(): number {
    return this.stunEndTime;
  }

  public isCurrentlyStunned(): boolean {
    return this.isStunned;
  }

  public getGuardId(): string {
    return this.guardId;
  }

  // Check if guard can attempt to climb based on timeline rules
  public canAttemptClimb(currentTime: number): boolean {
    if (this.state !== GuardState.IN_HOLE) {
      return false;
    }

    // Guard must have completed stun period
    return currentTime >= this.stunEndTime && !this.isStunned;
  }

  // Rule 7: Check if guard should die based on timeline
  // If tg1 + m >= t2, the guard will be killed and respawn after h seconds
  public shouldDieFromHole(holeCloseTime: number): boolean {
    if (!this.currentHole || this.fallTime === 0) {
      return false; // Guard not properly in hole
    }

    const guardRecoveryTime = this.fallTime + GAME_MECHANICS.GUARD_STUN_DURATION;
    const wouldDie = guardRecoveryTime >= holeCloseTime;

    if (wouldDie) {
      this.logger.debug(`Guard ${this.guardId} timeline death check: tg1=${this.fallTime}, m=${GAME_MECHANICS.GUARD_STUN_DURATION}, t2=${holeCloseTime}, tg1+m=${guardRecoveryTime} >= t2: ${wouldDie}`);
    }

    return wouldDie;
  }

  // Execute timeline-based death and respawn
  public executeTimelineBasedDeath(): void {
    this.logger.debug(`Guard ${this.guardId} dying due to timeline rule 7 - will respawn in ${GAME_MECHANICS.GUARD_RESPAWN_DELAY}ms`);
    
    // DON'T clear timeline data yet - keep it for shouldDieFromHole() checks
    // This ensures the hole filling logic can still determine the guard should die
    // All timeline data will be cleared in respawnAtStart()
    // this.currentHole = null; // MOVED TO respawnAtStart()
    // this.fallTime = 0; // MOVED TO respawnAtStart()
    // this.stunEndTime = 0; // MOVED TO respawnAtStart()
    this.isStunned = false; // Can clear this - guard is dead
    this.holeTimer = 0; // Can clear legacy timer

    // Trigger respawn with configured delay (h seconds)
    this.scene.time.delayedCall(GAME_MECHANICS.GUARD_RESPAWN_DELAY, () => {
      this.respawnAtStart();
    });

    // Set guard to temporary death state (reuse REBORN state for now)
    this.setState(GuardState.REBORN);
    
    // Hide guard during respawn delay
    this.sprite.setVisible(false);
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setEnable(false);
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
  
  
  // Handle falling into hole (timeline-based implementation)
  public fallIntoHole(holeKey: string, currentTime: number): void {
    // Don't trap guard if already in a hole
    if (this.state === GuardState.IN_HOLE || this.state === GuardState.STUNNED_IN_HOLE) {
      return;
    }
    
    this.logger.debug(`Guard ${this.guardId} falling into hole ${holeKey} at time ${currentTime}`);
    
    // Set timeline variables following Rule 6: Guard delayed for m seconds after falling
    this.fallTime = currentTime; // tg1
    this.stunEndTime = currentTime + GAME_MECHANICS.GUARD_STUN_DURATION; // tg1 + m
    this.isStunned = true;
    this.currentHole = holeKey;
    this.holeTimer = 0; // Keep legacy timer for compatibility
    
    // Start in stunned state (Rule 6: fainting period)
    this.setState(GuardState.STUNNED_IN_HOLE);
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // No gravity while in hole
  }
  
  // Legacy fallIntoHole method for backward compatibility
  public fallIntoHoleLegacy(holeKey: string): void {
    this.fallIntoHole(holeKey, Date.now());
  }
  
  // Legacy escape method - functionality moved to timeline-based system
  // Keeping for backward compatibility with existing attemptHoleEscape() calls
  
  // Check if guard can escape from hole (called when hole is about to fill)
  public attemptHoleEscape(): boolean {
    if (this.state !== GuardState.IN_HOLE) {
      return true; // Not in hole, so no problem
    }
    
    // Check if guard has time to escape (hole fills at 5s, guard can escape up to 4.5s)
    const maxEscapeTime = 4500; // 4.5 seconds - last chance before hole fills
    if (this.holeTimer < maxEscapeTime) {
      this.logger.debug(`Guard attempting escape from hole: timer=${(this.holeTimer / 1000).toFixed(1)}s, maxTime=${(maxEscapeTime / 1000).toFixed(1)}s`);
      this.setState(GuardState.ESCAPING_HOLE);
      
      // Start climbing animation - guard will climb out over 1 second
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
    
    this.logger.debug(`Guard starting hole escape climb from position Y: ${this.sprite.y.toFixed(1)}`);
    
    // Set upward velocity to climb out (slower for more visible climbing)
    body.setVelocityY(-80); // Slower climb speed for better visibility
    body.setVelocityX(0);   // No horizontal movement while climbing
    body.setGravityY(0);    // No gravity while climbing out
    
    // Use climbing animation
    this.sprite.anims.play('guard-climb', true);
    
    // Add intermediate position update for smoother climbing
    const climbTimer = this.scene.time.addEvent({
      delay: 100, // Update every 100ms
      repeat: 9,  // 10 updates over 1 second
      callback: () => {
        this.logger.debug(`Guard climbing - Y position: ${this.sprite.y.toFixed(1)}`);
      }
    });
    
    // After 1 second (extended from 0.5s), complete the escape
    this.scene.time.delayedCall(1000, () => {
      if (climbTimer) {
        climbTimer.destroy();
      }
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
    
    // Reset physics FIRST - this was the missing piece!
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setEnable(true); // Re-enable physics body that was disabled in executeTimelineBasedDeath
    body.setGravityY(600);
    body.setVelocity(0, 0);
    
    // Move guard back to spawn position
    this.sprite.setPosition(this.spawnPosition.x, this.spawnPosition.y);
    this.sprite.setVisible(true); // Make guard visible again
    
    // NOW clear ALL timeline data - guard has actually respawned
    this.currentHole = null; // Moved from executeTimelineBasedDeath
    this.fallTime = 0; // Moved from executeTimelineBasedDeath
    this.stunEndTime = 0; // Moved from executeTimelineBasedDeath
    
    // Reset timeline and hole state completely
    this.holeTimer = 0;
    this.isStunned = false;
    
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
      this.logger.debug(`Guard ${this.guardId} respawn complete - returning to normal AI`);
    });
  }
  
  // Check collision with player - implements Rule 8 conditional catching
  public checkPlayerCollision(player: Phaser.GameObjects.Sprite): boolean {
    if (this.state === GuardState.REBORN || 
        this.state === GuardState.ESCAPING_HOLE) {
      return false; // Can't collide when respawning or escaping from hole
    }

    // Rule 8: Special behavior for guards in holes
    if (this.state === GuardState.IN_HOLE || this.state === GuardState.STUNNED_IN_HOLE) {
      // Check if player is standing on top of this guard
      if (this.isEntityOnTop(player)) {
        // Rule 8: "When the Player is on top of him, the Player will not be caught"
        return false; // Player is safely on top of guard - no catching
      }
      
      // If player is NOT on top, guards in holes still can't catch normally
      // This maintains the existing hole behavior
      return false;
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
    // Only set ladder flag if cooldown has expired (prevents immediate re-entry after exiting)
    if (this.ladderExitCooldown <= 0) {
      this.onLadder = true;
    } else {
      // Check if this is a different ladder tile than the one we just exited
      const currentTileX = Math.floor(this.sprite.x / 32);
      if (currentTileX !== this.lastLadderTileX) {
        this.onLadder = true; // Allow climbing different ladders even during cooldown
      }
    }
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