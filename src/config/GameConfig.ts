import { GameConfig } from '@/types/GameTypes';

export const GAME_CONFIG: GameConfig = {
  width: 896,  // 28 tiles * 32px
  height: 672, // 21 tiles * 32px
  tileSize: 32,
  levelWidth: 28,
  levelHeight: 21
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