import { GAME_MECHANICS, TILE_TYPES, GAME_CONFIG } from '@/config/GameConfig';

export class AssetManager {

  // Load IBM-style sprite atlases with JSON frame data
  static loadIBMAssets(scene: Phaser.Scene): void {
    // Load sprite atlases with JSON frame configurations
    scene.load.atlas('runner', '/assets/sprites/runner.png', '/assets/sprites/runner.json');
    scene.load.atlas('guard', '/assets/sprites/guard.png', '/assets/sprites/guard.json');
    scene.load.atlas('tiles', '/assets/sprites/tiles.png', '/assets/sprites/tiles.json');
    scene.load.atlas('hole', '/assets/sprites/hole.png', '/assets/sprites/hole.json');

    // Load UI images
    scene.load.image('logo', '/assets/images/logo.png');
    scene.load.image('game-over', '/assets/images/game-over.png');
    scene.load.image('start-screen', '/assets/images/start-screen.png');

    // Load audio files
    scene.load.audio('dig', '/assets/audio/dig.wav');
    scene.load.audio('getGold', '/assets/audio/getGold.wav');
    scene.load.audio('dead', '/assets/audio/dead.wav');
    scene.load.audio('pass', '/assets/audio/pass.wav');
    scene.load.audio('fall', '/assets/audio/fall.wav');
    
    // Load level completion music
    scene.load.audio('goldFinish1', '/assets/audio/goldFinish1.mp3');
    scene.load.audio('goldFinish2', '/assets/audio/goldFinish2.mp3');
    scene.load.audio('goldFinish3', '/assets/audio/goldFinish3.mp3');

    // Load animation definition files
    scene.load.json('runner-anims', '/assets/anims/runner.json');
    scene.load.json('guard-anims', '/assets/anims/guard.json');
    scene.load.json('hole-anims', '/assets/anims/hole.json');
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
    createAnimation('player-dig-right', 'digRight', 12, 0);
    createAnimation('player-dig-left', 'digLeft', 12, 0);
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
    createAnimation('guard-shake-right', 'shakeRight', GAME_MECHANICS.ANIMATION_FPS.GUARD_SHAKE, 0);
    createAnimation('guard-shake-left', 'shakeLeft', GAME_MECHANICS.ANIMATION_FPS.GUARD_SHAKE, 0);

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
    createAnimation('hole-dig-left', 'digHoleLeft', GAME_MECHANICS.ANIMATION_FPS.HOLE_DIG, 0);
    createAnimation('hole-dig-right', 'digHoleRight', GAME_MECHANICS.ANIMATION_FPS.HOLE_DIG, 0);
    createAnimation('hole-fill', 'fillHole', GAME_MECHANICS.ANIMATION_FPS.HOLE_FILL, 0); // Speed up fill animation from 4 to 30 FPS
  }


  // Parse classic.json level data format
  static parseLevelData(levelArray: string[]): { tiles: number[][], playerStart: {x: number, y: number}, guards: {x: number, y: number}[], gold: {x: number, y: number}[], exitLadder: {x: number, y: number} | null, allSPositions: {x: number, y: number}[] } {
    const tiles: number[][] = [];
    const guards: {x: number, y: number}[] = [];
    const gold: {x: number, y: number}[] = [];
    let playerStart = { x: 0, y: 0 };
    let exitLadder: {x: number, y: number} | null = null;
    const allSPositions: {x: number, y: number}[] = [];
    
    // Find rightmost column with 'S' characters
    let rightmostSColumn = -1;
    for (let x = levelArray[0].length - 1; x >= 0; x--) {
      let hasS = false;
      for (let y = 0; y < levelArray.length; y++) {
        if (levelArray[y][x] === 'S') {
          hasS = true;
          break;
        }
      }
      if (hasS) {
        rightmostSColumn = x;
        break;
      }
    }
    
    // First pass: find the exit ladder position (topmost 'S' in the rightmost column that has 'S')
    let exitLadderX = -1;
    let exitLadderY = -1;
    // Find topmost 'S' in that column to be the exit ladder
    if (rightmostSColumn !== -1) {
      for (let y = 0; y < levelArray.length; y++) {
        if (levelArray[y][rightmostSColumn] === 'S') {
          exitLadderX = rightmostSColumn;
          exitLadderY = y;
          exitLadder = { x: exitLadderX * GAME_CONFIG.tileSize, y: exitLadderY * GAME_CONFIG.tileSize }; // Convert to pixel coordinates
          break; // First (topmost) S in rightmost column
        }
      }
    }

    levelArray.forEach((line, y) => {
      const row: number[] = [];
      for (let x = 0; x < line.length; x++) {
        const char = line[x];
        
        switch (char) {
          case ' ': row.push(TILE_TYPES.EMPTY); break; // Empty
          case '#': row.push(TILE_TYPES.BRICK); break; // Brick
          case 'H': row.push(TILE_TYPES.LADDER); break; // Ladder
          case '-': row.push(TILE_TYPES.ROPE); break; // Rope
          case 'S': // Exit ladder (hidden initially)
            allSPositions.push({ x: x * GAME_CONFIG.tileSize, y: y * GAME_CONFIG.tileSize });
            row.push(TILE_TYPES.EMPTY); // ALL S characters hidden initially
            break;
          case '$': 
            row.push(TILE_TYPES.EMPTY); // Empty space with gold
            gold.push({ x: x * GAME_CONFIG.tileSize, y: y * GAME_CONFIG.tileSize }); // Convert to pixel coordinates
            break;
          case '&': 
            row.push(TILE_TYPES.EMPTY); // Empty space with player
            playerStart = { x: x * GAME_CONFIG.tileSize, y: y * GAME_CONFIG.tileSize }; // Convert to pixel coordinates
            break;
          case '0': 
            row.push(TILE_TYPES.EMPTY); // Empty space with guard
            guards.push({ x: x * GAME_CONFIG.tileSize, y: y * GAME_CONFIG.tileSize }); // Convert to pixel coordinates
            break;
          case '@': row.push(TILE_TYPES.SOLID); break; // Solid block (cannot be dug)
          default: row.push(TILE_TYPES.EMPTY); // Default to empty
        }
      }
      tiles.push(row);
    });

    return { tiles, playerStart, guards, gold, exitLadder, allSPositions };
  }

  // Get tile sprite frame name from tile type
  static getTileFrame(tileType: number): string {
    switch (tileType) {
      case TILE_TYPES.EMPTY: return 'empty';
      case TILE_TYPES.BRICK: return 'brick';
      case TILE_TYPES.LADDER: return 'ladder';
      case TILE_TYPES.ROPE: return 'rope';
      case TILE_TYPES.SOLID: return 'solid'; // Solid block (@) - cannot be dug
      case TILE_TYPES.EXIT_LADDER: return 'ladder'; // Exit ladder (looks like ladder but hidden initially)
      default: return 'empty';
    }
  }

}