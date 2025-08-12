import { GameConfig } from '@/types/GameTypes';

export const GAME_CONFIG: GameConfig = {
  width: 896,  // 28 tiles * 32px
  height: 600, // 16 tiles * 32px + 88px UI space
  tileSize: 32,
  levelWidth: 28,
  levelHeight: 16
};

export const SCENE_KEYS = {
  BOOT: 'boot',
  PRELOAD: 'preload',
  MENU: 'menu',
  GAME: 'game',
  GAME_OVER: 'gameover',
  PAUSE: 'pause'
} as const;

export const ASSET_KEYS = {
  SPRITES: {
    PLAYER: 'player-sprite',
    GUARD: 'guard-sprite',
    TILES: 'tiles-sprite',
    GOLD: 'gold-sprite'
  },
  AUDIO: {
    WALK: 'walk-sound',
    COLLECT_GOLD: 'collect-gold',
    DIG: 'dig-sound',
    GAME_OVER: 'game-over'
  }
} as const;

// Game mechanics constants - following GPT-5 suggestion to avoid magic numbers
export const GAME_MECHANICS = {
  // Timeline constants for hole-guard-player mechanics
  HOLE_DURATION: 5000,             // n: Hole duration in milliseconds (t2 = t1 + n)
  GUARD_STUN_DURATION: 2000,       // m: Guard stun/faint time after falling into hole
  GUARD_RESPAWN_DELAY: 3000,       // h: Guard respawn delay after death in milliseconds
  
  // Legacy constants (keeping for backward compatibility)
  HOLE_FILL_DELAY: 5000,           // 5 seconds for holes to fill (same as HOLE_DURATION)
  PLAYER_INVINCIBILITY_TIME: 2000,  // 2 seconds invincibility after respawn
  EXIT_LADDER_FADE_DURATION: 2000,  // 2 seconds for exit ladder fade-in
  GUARD_MOVEMENT_SPEED: 60,         // Guard movement speed
  PLAYER_MOVEMENT_SPEED: 100,       // Player movement speed
  GRAVITY: 800,                     // Gravity force
  TILE_TYPES: {
    EMPTY: 0,
    BRICK: 1,      // Diggable
    SOLID: 2,      // Non-diggable
    LADDER: 3,
    ROPE: 4,
    CONCRETE: 5    // Non-diggable
  }
} as const;