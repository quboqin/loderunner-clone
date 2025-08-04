import { Scene } from 'phaser';
import { SCENE_KEYS } from '@/config/GameConfig';
import { AssetManager } from '@/managers/AssetManager';

export class PreloadScene extends Scene {
  private progressBar!: Phaser.GameObjects.Graphics;
  private progressText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.PRELOAD });
  }

  preload(): void {
    this.createLoadingUI();
    
    this.load.on('progress', this.updateProgress, this);
    this.load.on('complete', this.onLoadComplete, this);

    this.loadAssets();
  }

  private createLoadingUI(): void {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    this.add.text(centerX, centerY - 100, 'LODE RUNNER', {
      fontSize: '48px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    const progressBg = this.add.graphics();
    progressBg.fillStyle(0x333333);
    progressBg.fillRect(centerX - 200, centerY - 25, 400, 50);

    this.progressBar = this.add.graphics();

    this.progressText = this.add.text(centerX, centerY, '0%', {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
  }

  private updateProgress(value: number): void {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;
    
    this.progressBar.clear();
    this.progressBar.fillStyle(0x00ff00);
    this.progressBar.fillRect(centerX - 195, centerY - 20, 390 * value, 40);

    this.progressText.setText(`${Math.round(value * 100)}%`);
  }

  private loadAssets(): void {
    // Load placeholder sprites
    const sprites = AssetManager.createPlaceholderSprites();
    
    Object.entries(sprites).forEach(([key, dataUrl]) => {
      this.load.image(key, dataUrl);
    });
    
    // Simulate loading time for development
    for (let i = 0; i < 5; i++) {
      this.load.image(`dummy-${i}`, 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
    }
  }

  private onLoadComplete(): void {
    this.time.delayedCall(500, () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }
}