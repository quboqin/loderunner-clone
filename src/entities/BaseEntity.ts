/**
 * BaseEntity - Abstract base class for all game entities
 * Follows Phaser 3 best practices and SOLID principles
 */

import { Scene } from 'phaser';
import { Position } from '@/types/GameTypes';
import { Logger, LogCategory } from '@/utils/Logger';

export enum EntityType {
  PLAYER = 'player',
  GUARD = 'guard',
  PROJECTILE = 'projectile',
  COLLECTIBLE = 'collectible'
}

export interface EntityConfig {
  scene: Scene;
  x: number;
  y: number;
  texture: string;
  frame?: string | number;
  scale?: number;
  depth?: number;
}

export interface PhysicsConfig {
  width?: number;
  height?: number;
  offsetX?: number;
  offsetY?: number;
  gravityY?: number;
  bounce?: number;
  collideWorldBounds?: boolean;
}

export abstract class BaseEntity {
  public readonly sprite: Phaser.Physics.Arcade.Sprite;
  protected readonly scene: Scene;
  protected readonly entityType: EntityType;
  
  // Spawn position for respawning
  protected readonly spawnPosition: Position;
  
  // State management (to be defined by subclasses)
  protected abstract state: any;
  
  // Logging
  protected readonly logger: ReturnType<typeof Logger.createCategoryLogger>;

  constructor(config: EntityConfig, entityType: EntityType, logCategory: LogCategory) {
    this.scene = config.scene;
    this.entityType = entityType;
    this.logger = Logger.createCategoryLogger(logCategory);
    
    // Store spawn position
    this.spawnPosition = { x: config.x, y: config.y };
    
    // Create physics sprite
    this.sprite = this.scene.physics.add.sprite(
      config.x, 
      config.y, 
      config.texture, 
      config.frame
    );
    
    // Apply basic configuration
    if (config.scale !== undefined) {
      this.sprite.setScale(config.scale);
    }
    
    if (config.depth !== undefined) {
      this.sprite.setDepth(config.depth);
    }
    
    // Initialize entity
    this.initializePhysics();
    this.initializeEntity();
  }

  /**
   * Initialize physics body with default settings
   * Override in subclasses for custom physics
   */
  protected initializePhysics(config?: PhysicsConfig): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    // Apply physics configuration
    if (config) {
      if (config.width && config.height) {
        body.setSize(config.width, config.height);
      }
      
      if (config.offsetX !== undefined && config.offsetY !== undefined) {
        body.setOffset(config.offsetX, config.offsetY);
      }
      
      if (config.gravityY !== undefined) {
        body.setGravityY(config.gravityY);
      }
      
      if (config.bounce !== undefined) {
        body.setBounce(config.bounce);
      }
      
      if (config.collideWorldBounds !== undefined) {
        body.setCollideWorldBounds(config.collideWorldBounds);
      }
    }
    
    this.logger.debug(`Physics initialized for ${this.entityType} at (${this.sprite.x}, ${this.sprite.y})`);
  }

  /**
   * Entity-specific initialization
   * Override in subclasses for custom initialization
   */
  protected abstract initializeEntity(): void;

  /**
   * Abstract update method - must be implemented by subclasses
   */
  public abstract update(time: number, delta: number): void;

  /**
   * Abstract state management - must be implemented by subclasses
   */
  protected abstract setState(newState: any): void;
  public abstract getState(): any;

  /**
   * Get entity position
   */
  public getPosition(): Position {
    return {
      x: this.sprite.x,
      y: this.sprite.y
    };
  }

  /**
   * Set entity position
   */
  public setPosition(x: number, y: number): void {
    this.sprite.setPosition(x, y);
    this.logger.debug(`${this.entityType} moved to (${x}, ${y})`);
  }

  /**
   * Get spawn position
   */
  public getSpawnPosition(): Position {
    return { ...this.spawnPosition };
  }

  /**
   * Reset entity to spawn position
   */
  public respawn(): void {
    this.setPosition(this.spawnPosition.x, this.spawnPosition.y);
    
    // Reset physics
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setAcceleration(0, 0);
    
    // Reset visual state
    this.sprite.setAlpha(1.0);
    this.sprite.setVisible(true);
    
    this.logger.debug(`${this.entityType} respawned at spawn position`);
  }

  /**
   * Get entity bounds for collision detection
   */
  public getBounds(): Phaser.Geom.Rectangle {
    return this.sprite.getBounds();
  }

  /**
   * Check if entity overlaps with another entity
   */
  public overlaps(other: BaseEntity): boolean {
    return Phaser.Geom.Rectangle.Overlaps(this.getBounds(), other.getBounds());
  }

  /**
   * Get distance to another entity
   */
  public getDistanceTo(other: BaseEntity): number {
    return Phaser.Math.Distance.Between(
      this.sprite.x, this.sprite.y,
      other.sprite.x, other.sprite.y
    );
  }

  /**
   * Get direction to another entity
   */
  public getDirectionTo(other: BaseEntity): Position {
    return {
      x: other.sprite.x - this.sprite.x,
      y: other.sprite.y - this.sprite.y
    };
  }

  /**
   * Check if entity is on screen
   */
  public isOnScreen(): boolean {
    const camera = this.scene.cameras.main;
    return camera.worldView.contains(this.sprite.x, this.sprite.y);
  }

  /**
   * Animate sprite with tween
   */
  protected createTween(config: Phaser.Types.Tweens.TweenBuilderConfig): Phaser.Tweens.Tween {
    return this.scene.tweens.add({
      ...config,
      targets: this.sprite
    });
  }

  /**
   * Play animation on sprite
   */
  protected playAnimation(key: string, ignoreIfPlaying?: boolean): void {
    if (this.sprite.anims) {
      this.sprite.play(key, ignoreIfPlaying);
    }
  }

  /**
   * Get current animation key
   */
  protected getCurrentAnimation(): string | null {
    return this.sprite.anims?.currentAnim?.key || null;
  }

  /**
   * Reset entity to initial state
   * Override in subclasses for custom reset behavior
   */
  public abstract reset(): void;

  /**
   * Clean up entity resources
   */
  public destroy(): void {
    this.logger.debug(`Destroying ${this.entityType} entity`);
    
    // Stop any running tweens
    this.scene.tweens.killTweensOf(this.sprite);
    
    // Destroy sprite and physics body
    if (this.sprite) {
      this.sprite.destroy();
    }
  }

  /**
   * Entity type getter
   */
  public getEntityType(): EntityType {
    return this.entityType;
  }

  /**
   * Check if entity is active (visible and exists)
   */
  public isActive(): boolean {
    return this.sprite && this.sprite.active && this.sprite.visible;
  }

  /**
   * Set entity active state
   */
  public setActive(active: boolean): void {
    if (this.sprite) {
      this.sprite.setActive(active);
      this.sprite.setVisible(active);
    }
  }
}