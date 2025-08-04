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

  // Load IBM-style sprite atlases with JSON frame data
  static loadIBMAssets(scene: Phaser.Scene): void {
    // Load sprite atlases with JSON frame configurations
    scene.load.atlas('runner', 'assets/sprites/runner.png', 'assets/sprites/runner.json');
    scene.load.atlas('guard', 'assets/sprites/guard.png', 'assets/sprites/guard.json');
    scene.load.atlas('tiles', 'assets/sprites/tiles.png', 'assets/sprites/tiles.json');
    scene.load.atlas('hole', 'assets/sprites/hole.png', 'assets/sprites/hole.json');

    // Load UI images
    scene.load.image('logo', 'assets/images/logo.png');
    scene.load.image('game-over', 'assets/images/game-over.png');
    scene.load.image('start-screen', 'assets/images/start-screen.png');

    // Load audio files
    scene.load.audio('dig', 'assets/audio/dig.wav');
    scene.load.audio('getGold', 'assets/audio/getGold.wav');
    scene.load.audio('dead', 'assets/audio/dead.wav');
    scene.load.audio('pass', 'assets/audio/pass.wav');
    scene.load.audio('fall', 'assets/audio/fall.wav');
    
    // Load level completion music
    scene.load.audio('goldFinish1', 'assets/audio/goldFinish1.mp3');
    scene.load.audio('goldFinish2', 'assets/audio/goldFinish2.mp3');
    scene.load.audio('goldFinish3', 'assets/audio/goldFinish3.mp3');
  }

  // Create player animations from IBM runner atlas
  static createPlayerAnimations(scene: Phaser.Scene): void {
    // Running right animation (frames 0-8)
    scene.anims.create({
      key: 'player-run-right',
      frames: scene.anims.generateFrameNames('runner', {
        prefix: 'runner_',
        start: 0,
        end: 8,
        zeroPad: 2
      }),
      frameRate: 12,
      repeat: -1
    });

    // Running left animation (frames 9-17)
    scene.anims.create({
      key: 'player-run-left',
      frames: scene.anims.generateFrameNames('runner', {
        prefix: 'runner_',
        start: 9,
        end: 17,
        zeroPad: 2
      }),
      frameRate: 12,
      repeat: -1
    });

    // Idle animation (frame 0)
    scene.anims.create({
      key: 'player-idle',
      frames: [{ key: 'runner', frame: 'runner_00' }],
      frameRate: 1
    });

    // Climbing animation (frames 1-3)
    scene.anims.create({
      key: 'player-climb',
      frames: scene.anims.generateFrameNames('runner', {
        prefix: 'runner_',
        start: 1,
        end: 3,
        zeroPad: 2
      }),
      frameRate: 8,
      repeat: -1
    });
  }

  // Create enemy animations from IBM guard atlas
  static createEnemyAnimations(scene: Phaser.Scene): void {
    // Guard walking animation
    scene.anims.create({
      key: 'guard-walk',
      frames: scene.anims.generateFrameNames('guard', {
        prefix: 'guard_',
        start: 0,
        end: 7,
        zeroPad: 2
      }),
      frameRate: 8,
      repeat: -1
    });
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

  // Parse classic.json level data format
  static parseLevelData(levelArray: string[]): { tiles: number[][], playerStart: {x: number, y: number}, enemies: {x: number, y: number}[], gold: {x: number, y: number}[] } {
    const tiles: number[][] = [];
    const enemies: {x: number, y: number}[] = [];
    const gold: {x: number, y: number}[] = [];
    let playerStart = { x: 0, y: 0 };

    levelArray.forEach((line, y) => {
      const row: number[] = [];
      for (let x = 0; x < line.length; x++) {
        const char = line[x];
        switch (char) {
          case ' ': row.push(0); break; // Empty
          case '#': row.push(1); break; // Brick
          case 'S': row.push(2); break; // Solid
          case 'H': row.push(3); break; // Ladder
          case '-': row.push(4); break; // Rope
          case '$': 
            row.push(0); // Empty space with gold
            gold.push({ x: x * 32, y: y * 32 }); // Convert to pixel coordinates
            break;
          case '&': 
            row.push(0); // Empty space
            playerStart = { x: x * 32, y: y * 32 }; // Convert to pixel coordinates
            break;
          case '0': 
            row.push(0); // Empty space with enemy
            enemies.push({ x: x * 32, y: y * 32 }); // Convert to pixel coordinates
            break;
          case '@': row.push(5); break; // Special brick (can be dug)
          case 'X': row.push(6); break; // Exit
          default: row.push(0); // Default to empty
        }
      }
      tiles.push(row);
    });

    return { tiles, playerStart, enemies, gold };
  }

  // Get tile sprite frame name from tile type
  static getTileFrame(tileType: number): string {
    switch (tileType) {
      case 0: return 'empty';
      case 1: return 'brick';
      case 2: return 'solid';
      case 3: return 'ladder';
      case 4: return 'rope';
      case 5: return 'brick'; // Special brick
      case 6: return 'trap'; // Exit/trap
      default: return 'empty';
    }
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