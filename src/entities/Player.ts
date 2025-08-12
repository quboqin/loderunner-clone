/**
 * Player Entity - Extracted from GameScene for better architecture
 * Follows the same pattern as Guard.ts and extends BaseEntity
 */

import { BaseEntity, EntityConfig, EntityType, PhysicsConfig } from './BaseEntity';
import { PlayerState } from '@/types/GameTypes';
import { InputManager } from '@/managers/InputManager';
import { SoundManager } from '@/managers/SoundManager';
import { LogCategory } from '@/utils/Logger';
import { GAME_MECHANICS } from '@/config/GameConfig';

export class Player extends BaseEntity {
  protected state: PlayerState = PlayerState.IDLE;
  
  // Player-specific properties
  private speed: number = 200;
  private inputManager: InputManager;
  private soundManager: SoundManager;
  
  // Climbing state
  private onLadder: boolean = false;
  private onRope: boolean = false;
  private ropeY: number | undefined;
  private wasOnRope: boolean = false;
  private jumpingFromRope: boolean = false;
  
  // Invincibility system
  private isInvincible: boolean = false;
  private invincibilityEndTime: number = 0;
  
  // Detection results for debugging
  private detectionResults: string[] = [];

  constructor(config: EntityConfig, inputManager: InputManager, soundManager: SoundManager) {
    const playerConfig: EntityConfig = {
      ...config,
      texture: 'runner',
      frame: 'runner_00',
      scale: 1.6,
      depth: GAME_MECHANICS.DEPTHS.PLAYER
    };
    
    super(playerConfig, EntityType.PLAYER, LogCategory.PLAYER_MOVEMENT);
    
    this.inputManager = inputManager;
    this.soundManager = soundManager;
    this.setState(PlayerState.IDLE);
  }

  protected initializeEntity(): void {
    // Set up Player-specific physics
    const physicsConfig: PhysicsConfig = {
      width: 16 / 1.6, // Compensate for sprite scale
      height: 28 / 1.6,
      offsetX: 8 / 1.6,
      offsetY: 4 / 1.6,
      gravityY: 800,
      collideWorldBounds: true
    };
    
    this.initializePhysics(physicsConfig);
    
    // Play initial idle animation
    this.playAnimation('player-idle');
    
    this.logger.debug('Player entity initialized with physics and animations');
  }

  public update(time: number, _delta: number): void {
    try {
      // Update invincibility state
      this.updateInvincibilityState(time);
      
      // Handle player movement
      this.handleMovement();
      
      // Update climbing state detection
      this.updateClimbableState();
      
      // Enforce rope Y position lock
      this.enforceRopeYLock();
      
      // Update animations
      this.updateAnimations();
      
    } catch (error) {
      this.logger.error('Error in player update:', error);
    }
  }

  private updateInvincibilityState(currentTime: number): void {
    if (this.isInvincible && currentTime >= this.invincibilityEndTime) {
      this.isInvincible = false;
      this.sprite.setAlpha(1.0);
      this.logger.debug('Player invincibility ended');
    }
  }

  private handleMovement(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    const isClimbing = this.onLadder || this.onRope;

    // Reset horizontal velocity
    body.setVelocityX(0);
    let isMoving = false;

    // Horizontal movement
    if (this.inputManager.isLeftPressed()) {
      body.setVelocityX(-this.speed);
      this.setState(PlayerState.RUNNING_LEFT);
      isMoving = true;
    } else if (this.inputManager.isRightPressed()) {
      body.setVelocityX(this.speed);
      this.setState(PlayerState.RUNNING_RIGHT);
      isMoving = true;
    }

    // Handle gravity and vertical movement based on climbing state
    if (isClimbing) {
      this.handleClimbingMovement(body, isMoving);
    } else {
      // Re-enable physics when not climbing
      body.moves = true;
      if (body.gravity.y !== 800) {
        body.setGravityY(800);
        body.setAccelerationY(0);
      }
    }

    // Set idle state if not moving
    if (!isMoving && !isClimbing) {
      this.setState(PlayerState.IDLE);
    }
  }

  private handleClimbingMovement(body: Phaser.Physics.Arcade.Body, movingHorizontally: boolean): void {
    // Disable gravity while climbing
    body.setGravityY(0);
    
    const movingUp = this.inputManager.isUpPressed();
    const movingDown = this.inputManager.isDownPressed();
    
    // For ropes: ignore up input, but allow down (jump/drop from rope)
    const effectiveMovingUp = this.onRope ? false : movingUp;
    const effectiveMovingDown = movingDown;
    const hasAnyInput = effectiveMovingUp || effectiveMovingDown || movingHorizontally;
    
    if (hasAnyInput) {
      // Enable physics when movement is detected
      body.moves = true;
      
      // Handle vertical movement (only for ladders)
      if (effectiveMovingUp) {
        body.setVelocityY(-this.speed);
        if (!movingHorizontally) {
          this.setState(PlayerState.CLIMBING);
        }
      } else if (effectiveMovingDown && !this.onRope) {
        // Ladder down movement
        body.setVelocityY(this.speed);
        if (!movingHorizontally) {
          this.setState(PlayerState.CLIMBING);
        }
      } else if (effectiveMovingDown && this.onRope) {
        // Jump down from rope
        this.jumpFromRope(body);
      } else if (movingHorizontally && this.onRope) {
        // Rope horizontal movement
        this.handleRopeMovement(body);
      } else if (movingHorizontally && !this.onRope) {
        // Ladder horizontal movement
        body.setVelocityY(0);
        body.setAccelerationY(0);
      }
    } else {
      // No input - disable physics to prevent sliding
      body.moves = false;
      body.setVelocityY(0);
      body.setAccelerationY(0);
      
      if (this.onRope) {
        this.setState(PlayerState.IDLE);
      }
    }
  }

  private jumpFromRope(body: Phaser.Physics.Arcade.Body): void {
    body.moves = true;
    body.setGravityY(800);
    body.setVelocityY(this.speed * 1.5);
    
    // Set jumping flag to prevent rope re-detection
    this.jumpingFromRope = true;
    this.scene.time.delayedCall(GAME_MECHANICS.DELAYS.PLAYER_RESPAWN, () => {
      this.jumpingFromRope = false;
    });
    
    // Clear rope state
    this.onRope = false;
    this.wasOnRope = false;
    this.ropeY = undefined;
    
    // Set falling animation
    if (this.inputManager.isLeftPressed()) {
      this.setState(PlayerState.FALLING);
    } else if (this.inputManager.isRightPressed()) {
      this.setState(PlayerState.FALLING);
    } else {
      this.setState(PlayerState.FALLING);
    }
  }

  private handleRopeMovement(body: Phaser.Physics.Arcade.Body): void {
    body.setVelocityY(0);
    body.setAccelerationY(0);
    
    if (this.inputManager.isLeftPressed()) {
      this.setState(PlayerState.BAR_LEFT);
    } else {
      this.setState(PlayerState.BAR_RIGHT);
    }
  }

  private updateClimbableState(): void {
    // This will be called from GameScene with collision detection results
    // For now, reset states (will be set by collision callbacks)
    this.detectionResults = [];
  }

  private enforceRopeYLock(): void {
    if (this.onRope && !this.jumpingFromRope && this.ropeY !== undefined) {
      if (this.onRope && !this.wasOnRope) {
        this.sprite.setY(this.ropeY);
      } else if (Math.abs(this.sprite.y - this.ropeY) > 0.1) {
        this.sprite.setY(this.ropeY);
        const body = this.sprite.body as Phaser.Physics.Arcade.Body;
        body.y = this.ropeY - body.height / 2 - body.offset.y;
      }
    }
    
    this.wasOnRope = this.onRope;
  }

  private updateAnimations(): void {
    switch (this.state) {
      case PlayerState.IDLE:
        if (this.getCurrentAnimation() !== 'player-idle') {
          this.playAnimation('player-idle');
        }
        break;
        
      case PlayerState.RUNNING_LEFT:
        this.playAnimation('player-run-left', true);
        break;
        
      case PlayerState.RUNNING_RIGHT:
        this.playAnimation('player-run-right', true);
        break;
        
      case PlayerState.CLIMBING:
        this.playAnimation('player-climb', true);
        break;
        
      case PlayerState.BAR_LEFT:
        this.playAnimation('player-bar-left', true);
        break;
        
      case PlayerState.BAR_RIGHT:
        this.playAnimation('player-bar-right', true);
        break;
        
      case PlayerState.FALLING:
        if (this.inputManager.isLeftPressed()) {
          this.playAnimation('player-fall-left', true);
        } else if (this.inputManager.isRightPressed()) {
          this.playAnimation('player-fall-right', true);
        } else {
          this.playAnimation('player-fall-right', true);
        }
        break;
        
      case PlayerState.DIGGING_LEFT:
        this.playAnimation('hole-dig-left');
        break;
        
      case PlayerState.DIGGING_RIGHT:
        this.playAnimation('hole-dig-right');
        break;
    }
  }

  protected setState(newState: PlayerState): void {
    if (this.state !== newState) {
      this.logger.debug(`Player state changed: ${this.state} -> ${newState}`);
      this.state = newState;
    }
  }

  public getState(): PlayerState {
    return this.state;
  }

  // Climbing state setters (called from GameScene collision detection)
  public setClimbableState(ladder: boolean, rope: boolean, ropeYPosition?: number): void {
    this.onLadder = ladder;
    this.onRope = rope;
    
    // Initialize rope Y lock when first touching rope
    if (rope && !this.wasOnRope) {
      // Use the provided rope Y position (from rope tile) for perfect alignment
      this.ropeY = ropeYPosition !== undefined ? ropeYPosition : this.sprite.y;
      this.logger.debug('Rope Y position locked at:', this.ropeY);
    }
  }

  // Digging actions
  public digLeft(): void {
    if (this.canDig()) {
      this.setState(PlayerState.DIGGING_LEFT);
      this.soundManager.playSFX('dig');
      
      // Return to idle after digging animation
      this.scene.time.delayedCall(GAME_MECHANICS.DELAYS.DIG_COMPLETE, () => {
        if (this.state === PlayerState.DIGGING_LEFT) {
          this.setState(PlayerState.IDLE);
        }
      });
      
      this.logger.debug('Player dug hole to the left');
    }
  }

  public digRight(): void {
    if (this.canDig()) {
      this.setState(PlayerState.DIGGING_RIGHT);
      this.soundManager.playSFX('dig');
      
      // Return to idle after digging animation
      this.scene.time.delayedCall(GAME_MECHANICS.DELAYS.DIG_COMPLETE, () => {
        if (this.state === PlayerState.DIGGING_RIGHT) {
          this.setState(PlayerState.IDLE);
        }
      });
      
      this.logger.debug('Player dug hole to the right');
    }
  }

  private canDig(): boolean {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    return (body.onFloor() || this.onLadder) && !this.state.toString().includes('digging');
  }

  // Invincibility system
  public activateInvincibility(duration: number): void {
    this.isInvincible = true;
    this.invincibilityEndTime = this.scene.time.now + duration;
    this.sprite.setAlpha(0.7);
    
    this.logger.debug(`Player invincibility activated for ${duration}ms`);
  }

  public getIsInvincible(): boolean {
    return this.isInvincible;
  }

  // Gold collection (simplified - actual logic will remain in GameScene)
  public collectGold(): void {
    this.soundManager.playSFX('getGold');
    this.logger.debug('Player collected gold');
  }

  // Player death handling
  public die(): void {
    this.soundManager.playSFX('dead');
    this.logger.debug('Player died');
  }

  // Debug methods
  public setDetectionResults(results: string[]): void {
    this.detectionResults = results;
  }

  public getDetectionResults(): string[] {
    return [...this.detectionResults];
  }

  public getClimbingState(): { onLadder: boolean; onRope: boolean } {
    return {
      onLadder: this.onLadder,
      onRope: this.onRope
    };
  }

  public reset(): void {
    // Reset player state
    this.setState(PlayerState.IDLE);
    this.onLadder = false;
    this.onRope = false;
    this.ropeY = undefined;
    this.wasOnRope = false;
    this.jumpingFromRope = false;
    this.isInvincible = false;
    this.invincibilityEndTime = 0;
    this.detectionResults = [];
    
    // Reset physics
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(800);
    body.moves = true;
    
    // Reset visual state
    this.sprite.setAlpha(1.0);
    
    this.logger.debug('Player reset to initial state');
  }
}