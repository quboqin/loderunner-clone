export class AssetManager {
  private static instance: AssetManager;
  private loadedAssets: Map<string, any> = new Map();

  private constructor() {}

  static getInstance(): AssetManager {
    if (!AssetManager.instance) {
      AssetManager.instance = new AssetManager();
    }
    return AssetManager.instance;
  }

  // Create placeholder sprites as colored rectangles for development
  static createPlaceholderSprites(): { [key: string]: string } {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d')!;
    canvas.width = 32;
    canvas.height = 32;

    const sprites: { [key: string]: string } = {};

    // Player sprite (red)
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(4, 2, 24, 30);
    sprites.player = canvas.toDataURL();

    // Clear canvas
    ctx.clearRect(0, 0, 32, 32);

    // Brick tile (brown)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(0, 0, 32, 32);
    ctx.strokeStyle = '#654321';
    ctx.lineWidth = 1;
    ctx.strokeRect(0, 0, 32, 32);
    sprites.brick = canvas.toDataURL();

    ctx.clearRect(0, 0, 32, 32);

    // Solid tile (dark gray)
    ctx.fillStyle = '#444444';
    ctx.fillRect(0, 0, 32, 32);
    sprites.solid = canvas.toDataURL();

    ctx.clearRect(0, 0, 32, 32);

    // Ladder (yellow)
    ctx.fillStyle = '#FFFF00';
    ctx.fillRect(8, 0, 4, 32);
    ctx.fillRect(20, 0, 4, 32);
    for (let i = 0; i < 32; i += 6) {
      ctx.fillRect(6, i, 20, 2);
    }
    sprites.ladder = canvas.toDataURL();

    ctx.clearRect(0, 0, 32, 32);

    // Rope (brown)
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(14, 0, 4, 32);
    sprites.rope = canvas.toDataURL();

    ctx.clearRect(0, 0, 32, 32);

    // Gold (yellow circle)
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(16, 16, 10, 0, Math.PI * 2);
    ctx.fill();
    sprites.gold = canvas.toDataURL();

    ctx.clearRect(0, 0, 32, 32);

    // Enemy (purple)
    ctx.fillStyle = '#9B59B6';
    ctx.fillRect(4, 2, 24, 30);
    sprites.enemy = canvas.toDataURL();

    return sprites;
  }

  // Asset loading utilities for future integration with Roku repository
  async loadSpriteSheet(scene: Phaser.Scene, key: string, url: string, frameConfig?: any): Promise<void> {
    return new Promise((resolve, reject) => {
      scene.load.spritesheet(key, url, frameConfig);
      scene.load.once(`filecomplete-spritesheet-${key}`, () => {
        this.loadedAssets.set(key, true);
        resolve();
      });
      scene.load.once(`loaderror`, () => {
        console.warn(`Failed to load spritesheet: ${key}`);
        reject(new Error(`Failed to load ${key}`));
      });
    });
  }

  async loadImage(scene: Phaser.Scene, key: string, url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      scene.load.image(key, url);
      scene.load.once(`filecomplete-image-${key}`, () => {
        this.loadedAssets.set(key, true);
        resolve();
      });
      scene.load.once(`loaderror`, () => {
        console.warn(`Failed to load image: ${key}`);
        reject(new Error(`Failed to load ${key}`));
      });
    });
  }

  async loadAudio(scene: Phaser.Scene, key: string, urls: string[]): Promise<void> {
    return new Promise((resolve, reject) => {
      scene.load.audio(key, urls);
      scene.load.once(`filecomplete-audio-${key}`, () => {
        this.loadedAssets.set(key, true);
        resolve();
      });
      scene.load.once(`loaderror`, () => {
        console.warn(`Failed to load audio: ${key}`);
        reject(new Error(`Failed to load ${key}`));
      });
    });
  }

  isAssetLoaded(key: string): boolean {
    return this.loadedAssets.has(key);
  }

  // Level data parsing for future integration
  parseLevelData(levelString: string): number[][] {
    const lines = levelString.trim().split('\n');
    return lines.map(line => {
      return line.split('').map(char => {
        switch (char) {
          case ' ': return 0; // Empty
          case '#': return 1; // Brick
          case 'S': return 2; // Solid
          case 'H': return 3; // Ladder
          case '-': return 4; // Rope
          case 'G': return 5; // Gold
          case 'P': return 6; // Player start
          case 'E': return 7; // Enemy start
          default: return 0;
        }
      });
    });
  }

  // Asset optimization utilities
  optimizeAssetLoading(scene: Phaser.Scene): void {
    // Enable file size limits and compression
    scene.load.maxParallelDownloads = 4;
    
    // Add progress tracking
    scene.load.on('progress', (progress: number) => {
      console.log(`Loading progress: ${Math.round(progress * 100)}%`);
    });

    scene.load.on('complete', () => {
      console.log('All assets loaded successfully');
    });
  }
}