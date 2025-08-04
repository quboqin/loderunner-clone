import { Scene } from 'phaser';
import { SCENE_KEYS } from '@/config/GameConfig';

export class BootScene extends Scene {
  constructor() {
    super({ key: SCENE_KEYS.BOOT });
  }

  preload(): void {
    this.load.image('loading-bg', 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==');
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#000000');
    
    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2,
      'LODE RUNNER',
      {
        fontSize: '48px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      }
    ).setOrigin(0.5);

    this.add.text(
      this.cameras.main.width / 2,
      this.cameras.main.height / 2 + 60,
      'Loading...',
      {
        fontSize: '24px',
        color: '#cccccc',
        fontFamily: 'Arial, sans-serif'
      }
    ).setOrigin(0.5);

    this.time.delayedCall(1000, () => {
      this.scene.start(SCENE_KEYS.PRELOAD);
    });
  }
}