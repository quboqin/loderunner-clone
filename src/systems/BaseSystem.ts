/**
 * BaseSystem - Abstract base class for all game systems
 * Provides common lifecycle and dependency injection patterns
 * Following Phaser 3 best practices and SOLID principles
 */
import { Scene } from 'phaser';
import { GameLogger } from '@/utils/Logger';

export abstract class BaseSystem {
  protected scene: Scene;
  protected logger: typeof GameLogger;
  
  constructor(scene: Scene) {
    this.scene = scene;
    this.logger = GameLogger;
    this.initialize();
  }
  
  /**
   * Initialize system-specific setup
   * Called automatically in constructor
   */
  protected abstract initialize(): void;
  
  /**
   * Update system state
   * Called every frame from scene's update loop
   */
  public abstract update(time: number, delta: number): void;
  
  /**
   * Clean up system resources
   * Called when system is destroyed or scene ends
   */
  public abstract cleanup(): void;
  
  /**
   * Get system name for debugging and logging
   */
  public abstract getSystemName(): string;
  
  /**
   * Check if system is active and processing
   */
  public abstract isActive(): boolean;
}