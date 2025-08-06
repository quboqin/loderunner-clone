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
    scene.load.atlas('runner', './assets/sprites/runner.png', './assets/sprites/runner.json');
    scene.load.atlas('guard', './assets/sprites/guard.png', './assets/sprites/guard.json');
    scene.load.atlas('tiles', './assets/sprites/tiles.png', './assets/sprites/tiles.json');
    scene.load.atlas('hole', './assets/sprites/hole.png', './assets/sprites/hole.json');

    // Load UI images
    scene.load.image('logo', './assets/images/logo.png');
    scene.load.image('game-over', './assets/images/game-over.png');
    scene.load.image('start-screen', './assets/images/start-screen.png');

    // Load audio files
    scene.load.audio('dig', './assets/audio/dig.wav');
    scene.load.audio('getGold', './assets/audio/getGold.wav');
    scene.load.audio('dead', './assets/audio/dead.wav');
    scene.load.audio('pass', './assets/audio/pass.wav');
    scene.load.audio('fall', './assets/audio/fall.wav');
    
    // Load level completion music
    scene.load.audio('goldFinish1', './assets/audio/goldFinish1.mp3');
    scene.load.audio('goldFinish2', './assets/audio/goldFinish2.mp3');
    scene.load.audio('goldFinish3', './assets/audio/goldFinish3.mp3');

    // Load animation definition files
    scene.load.json('runner-anims', './assets/anims/runner.json');
    scene.load.json('guard-anims', './assets/anims/guard.json');
    scene.load.json('hole-anims', './assets/anims/hole.json');
  }

  // Create player animations from IBM runner atlas using JSON definitions
  static createPlayerAnimations(scene: Phaser.Scene): void {
    const animData = scene.cache.json.get('runner-anims');
    const sequences = animData.sequence;

    // Helper function to create animation from frame sequence
    const createAnimation = (key: string, sequenceKey: string, frameRate: number = 12, repeat: number = -1) => {
      const frames = sequences[sequenceKey].map((frameIndex: number) => ({
        key: 'runner',
        frame: `runner_${frameIndex.toString().padStart(2, '0')}`
      }));

      scene.anims.create({
        key,
        frames,
        frameRate,
        repeat
      });
    };

    // Create all runner animations from JSON
    createAnimation('player-run-right', 'runRight', 12, -1);
    createAnimation('player-run-left', 'runLeft', 12, -1);
    createAnimation('player-climb', 'runUpDown', 8, -1);
    createAnimation('player-bar-right', 'barRight', 8, -1);
    createAnimation('player-bar-left', 'barLeft', 8, -1);
    createAnimation('player-dig-right', 'digRight', 1, 0);
    createAnimation('player-dig-left', 'digLeft', 1, 0);
    createAnimation('player-fall-right', 'fallRight', 1, 0);
    createAnimation('player-fall-left', 'fallLeft', 1, 0);

    // Idle animation (use first frame of runRight)
    scene.anims.create({
      key: 'player-idle',
      frames: [{ key: 'runner', frame: 'runner_00' }],
      frameRate: 1
    });
  }

  // Create guard animations from IBM guard atlas using JSON definitions
  static createGuardAnimations(scene: Phaser.Scene): void {
    const animData = scene.cache.json.get('guard-anims');
    const sequences = animData.sequence;

    // Helper function to create animation from frame sequence
    const createAnimation = (key: string, sequenceKey: string, frameRate: number = 8, repeat: number = -1) => {
      const frames = sequences[sequenceKey].map((frameIndex: number) => ({
        key: 'guard',
        frame: `guard_${frameIndex.toString().padStart(2, '0')}`
      }));

      scene.anims.create({
        key,
        frames,
        frameRate,
        repeat
      });
    };

    // Create all guard animations from JSON
    createAnimation('guard-run-right', 'runRight', 8, -1);
    createAnimation('guard-run-left', 'runLeft', 8, -1);
    createAnimation('guard-climb', 'runUpDown', 6, -1);
    createAnimation('guard-bar-right', 'barRight', 6, -1);
    createAnimation('guard-bar-left', 'barLeft', 6, -1);
    createAnimation('guard-reborn', 'reborn', 4, 0);
    createAnimation('guard-fall-right', 'fallRight', 1, 0);
    createAnimation('guard-fall-left', 'fallLeft', 1, 0);
    createAnimation('guard-shake-right', 'shakeRight', 10, 0);
    createAnimation('guard-shake-left', 'shakeLeft', 10, 0);

    // Guard idle animation (use first frame of runRight)
    scene.anims.create({
      key: 'guard-idle',
      frames: [{ key: 'guard', frame: 'guard_00' }],
      frameRate: 1
    });
  }

  // Create hole animations from IBM hole atlas using JSON definitions
  static createHoleAnimations(scene: Phaser.Scene): void {
    const animData = scene.cache.json.get('hole-anims');
    const sequences = animData.sequence;

    // Helper function to create animation from frame sequence
    const createAnimation = (key: string, sequenceKey: string, frameRate: number = 8, repeat: number = 0) => {
      const frames = sequences[sequenceKey].map((frameIndex: number) => ({
        key: 'hole',
        frame: `hole_${frameIndex.toString().padStart(2, '0')}`
      }));

      scene.anims.create({
        key,
        frames,
        frameRate,
        repeat
      });
    };

    // Create all hole animations from JSON
    createAnimation('hole-dig-left', 'digHoleLeft', 10, 0);
    createAnimation('hole-dig-right', 'digHoleRight', 10, 0);
    createAnimation('hole-fill', 'fillHole', 4, 0);
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
  static parseLevelData(levelArray: string[]): { tiles: number[][], playerStart: {x: number, y: number}, guards: {x: number, y: number}[], gold: {x: number, y: number}[] } {
    const tiles: number[][] = [];
    const guards: {x: number, y: number}[] = [];
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
            row.push(0); // Empty space with guard
            guards.push({ x: x * 32, y: y * 32 }); // Convert to pixel coordinates
            break;
          case '@': row.push(5); break; // Special brick (can be dug)
          case 'X': row.push(6); break; // Exit
          default: row.push(0); // Default to empty
        }
      }
      tiles.push(row);
    });

    return { tiles, playerStart, guards, gold };
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
      // Loading progress tracking
    });

    scene.load.on('complete', () => {
      // All assets loaded
    });
  }
}