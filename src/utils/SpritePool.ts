/**
 * SpritePool - Object pooling system for efficient sprite management
 * Reduces garbage collection and improves performance by recycling sprites
 */

import { Scene } from 'phaser';

export interface PooledSprite extends Phaser.GameObjects.Sprite {
  inUse: boolean;
  poolType: string;
}

export class SpritePool {
  private scene: Scene;
  private pools: Map<string, PooledSprite[]> = new Map();
  private activeSprites: Map<string, Set<PooledSprite>> = new Map();
  
  constructor(scene: Scene) {
    this.scene = scene;
  }
  
  /**
   * Pre-allocate sprites for a specific type
   */
  public createPool(poolType: string, texture: string, frame: string | number, size: number = 10): void {
    const pool: PooledSprite[] = [];
    const active = new Set<PooledSprite>();
    
    for (let i = 0; i < size; i++) {
      const sprite = this.scene.add.sprite(0, 0, texture, frame) as PooledSprite;
      sprite.setVisible(false);
      sprite.setActive(false);
      sprite.inUse = false;
      sprite.poolType = poolType;
      pool.push(sprite);
    }
    
    this.pools.set(poolType, pool);
    this.activeSprites.set(poolType, active);
  }
  
  /**
   * Get a sprite from the pool
   */
  public getSprite(poolType: string, x: number, y: number): PooledSprite | null {
    const pool = this.pools.get(poolType);
    const active = this.activeSprites.get(poolType);
    
    if (!pool || !active) {
      console.warn(`Pool type '${poolType}' not found`);
      return null;
    }
    
    // Find an available sprite
    let sprite = pool.find(s => !s.inUse);
    
    // If no sprite available, expand the pool
    if (!sprite) {
      const firstSprite = pool[0];
      sprite = this.scene.add.sprite(0, 0, firstSprite.texture.key, firstSprite.frame.name) as PooledSprite;
      sprite.poolType = poolType;
      pool.push(sprite);
    }
    
    // Activate and position the sprite
    sprite.setPosition(x, y);
    sprite.setVisible(true);
    sprite.setActive(true);
    sprite.inUse = true;
    sprite.setAlpha(1);
    sprite.setScale(1);
    
    active.add(sprite);
    
    return sprite;
  }
  
  /**
   * Return a sprite to the pool
   */
  public releaseSprite(sprite: PooledSprite): void {
    const active = this.activeSprites.get(sprite.poolType);
    
    if (active) {
      active.delete(sprite);
    }
    
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.inUse = false;
    sprite.setPosition(-100, -100); // Move off-screen
    
    // Reset any tweens on the sprite
    this.scene.tweens.killTweensOf(sprite);
  }
  
  /**
   * Release all sprites of a specific type
   */
  public releaseAll(poolType: string): void {
    const active = this.activeSprites.get(poolType);
    
    if (active) {
      active.forEach(sprite => this.releaseSprite(sprite));
    }
  }
  
  /**
   * Get statistics about pool usage
   */
  public getStats(): Map<string, { total: number, active: number }> {
    const stats = new Map<string, { total: number, active: number }>();
    
    this.pools.forEach((pool, type) => {
      const active = this.activeSprites.get(type)?.size || 0;
      stats.set(type, {
        total: pool.length,
        active: active
      });
    });
    
    return stats;
  }
  
  /**
   * Clean up all pools
   */
  public destroy(): void {
    this.pools.forEach(pool => {
      pool.forEach(sprite => sprite.destroy());
    });
    
    this.pools.clear();
    this.activeSprites.clear();
  }
}