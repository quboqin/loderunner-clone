export interface GameConfig {
  width: number;
  height: number;
  tileSize: number;
  levelWidth: number;
  levelHeight: number;
}

export interface GameState {
  currentLevel: number;
  score: number;
  lives: number;
  goldCollected: number;
  totalGold: number;
}

export interface Position {
  x: number;
  y: number;
}

export enum Direction {
  LEFT = 'left',
  RIGHT = 'right',
  UP = 'up',
  DOWN = 'down',
  NONE = 'none'
}

export enum TileType {
  EMPTY = 0,
  BRICK = 1,
  SOLID = 2,
  LADDER = 3,
  ROPE = 4,
  GOLD = 5,
  PLAYER_START = 6,
  GUARD_START = 7
}