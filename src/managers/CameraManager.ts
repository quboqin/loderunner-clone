/**
 * CameraManager - Optimized camera control system
 * Replaces individual sprite scaling with camera zoom for better performance
 * Reduces per-sprite scale calculations and improves batching
 */

import { Scene } from 'phaser';
import { GAME_CONFIG } from '@/config/GameConfig';
import { Logger, LogCategory } from '@/utils/Logger';

export class CameraManager {
  private scene: Scene;
  private mainCamera!: Phaser.Cameras.Scene2D.Camera;
  private logger = Logger.createCategoryLogger(LogCategory.LEVEL_LOADING);
  
  // Camera settings optimized for performance
  private readonly ZOOM_LEVEL = 1.6; // Original sprite scale, now applied to camera
  private readonly SMOOTH_FOLLOW = false; // Disable for better performance
  
  constructor(scene: Scene) {
    this.scene = scene;
  }
  
  /**
   * Initialize camera with optimized settings
   */
  public initialize(): void {
    this.mainCamera = this.scene.cameras.main;
    
    // Apply zoom instead of scaling individual sprites
    this.mainCamera.setZoom(this.ZOOM_LEVEL);
    
    // Set bounds to prevent camera from showing outside game area
    const worldWidth = GAME_CONFIG.levelWidth * GAME_CONFIG.tileSize;
    const worldHeight = GAME_CONFIG.levelHeight * GAME_CONFIG.tileSize;
    this.mainCamera.setBounds(0, 0, worldWidth, worldHeight);
    
    // Disable camera smoothing for better performance
    this.mainCamera.setLerp(1, 1);
    
    this.logger.debug(`Camera initialized: zoom=${this.ZOOM_LEVEL}, bounds=${worldWidth}x${worldHeight}`);
  }
  
  /**
   * Set camera to follow player with optimized settings
   */
  public followPlayer(playerSprite: Phaser.GameObjects.Sprite): void {
    // Use simple following without smoothing for better performance
    this.mainCamera.startFollow(playerSprite, this.SMOOTH_FOLLOW);
    
    // Set deadzone to prevent excessive camera movement
    const deadzoneWidth = GAME_CONFIG.width / (this.ZOOM_LEVEL * 4);
    const deadzoneHeight = GAME_CONFIG.height / (this.ZOOM_LEVEL * 4);
    this.mainCamera.setDeadzone(deadzoneWidth, deadzoneHeight);
    
    this.logger.debug(`Camera following player with deadzone: ${deadzoneWidth}x${deadzoneHeight}`);
  }
  
  /**
   * Stop following player
   */
  public stopFollow(): void {
    this.mainCamera.stopFollow();
  }
  
  /**
   * Get current camera zoom level
   */
  public getZoom(): number {
    return this.mainCamera.zoom;
  }
  
  /**
   * Set camera zoom (use sparingly for performance)
   */
  public setZoom(zoom: number): void {
    this.mainCamera.setZoom(zoom);
    this.logger.debug(`Camera zoom set to: ${zoom}`);
  }
  
  /**
   * Reset camera to center position
   */
  public resetPosition(): void {
    const centerX = (GAME_CONFIG.levelWidth * GAME_CONFIG.tileSize) / 2;
    const centerY = (GAME_CONFIG.levelHeight * GAME_CONFIG.tileSize) / 2;
    this.mainCamera.centerOn(centerX, centerY);
  }
  
  /**
   * Get world coordinates from screen coordinates (accounting for zoom)
   */
  public screenToWorld(screenX: number, screenY: number): { x: number, y: number } {
    const worldX = (screenX - this.mainCamera.worldView.x) / this.mainCamera.zoom;
    const worldY = (screenY - this.mainCamera.worldView.y) / this.mainCamera.zoom;
    return { x: worldX, y: worldY };
  }
  
  /**
   * Get screen coordinates from world coordinates
   */
  public worldToScreen(worldX: number, worldY: number): { x: number, y: number } {
    const screenX = (worldX * this.mainCamera.zoom) + this.mainCamera.worldView.x;
    const screenY = (worldY * this.mainCamera.zoom) + this.mainCamera.worldView.y;
    return { x: screenX, y: screenY };
  }
  
  /**
   * Check if world coordinates are visible on screen
   */
  public isVisible(worldX: number, worldY: number, margin: number = 0): boolean {
    return this.mainCamera.worldView.contains(worldX - margin, worldY - margin) ||
           this.mainCamera.worldView.contains(worldX + margin, worldY + margin);
  }
  
  /**
   * Get camera viewport bounds in world coordinates
   */
  public getWorldBounds(): Phaser.Geom.Rectangle {
    return this.mainCamera.worldView;
  }
  
  /**
   * Cleanup camera manager
   */
  public destroy(): void {
    if (this.mainCamera) {
      this.mainCamera.stopFollow();
      // Reset camera to default state
      this.mainCamera.setZoom(1);
      this.mainCamera.setLerp(0.1, 0.1);
    }
    
    this.logger.debug('CameraManager destroyed');
  }
}