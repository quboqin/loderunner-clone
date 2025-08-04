import { Game, Types } from 'phaser';
import { GAME_CONFIG } from '@/config/GameConfig';

// Import all scenes
import { BootScene } from '@/scenes/BootScene';
import { PreloadScene } from '@/scenes/PreloadScene';
import { MenuScene } from '@/scenes/MenuScene';
import { GameScene } from '@/scenes/GameScene';
import { GameOverScene } from '@/scenes/GameOverScene';

class LodeRunnerGame extends Game {
  constructor(config: Types.Core.GameConfig) {
    super(config);
  }
}

// Game configuration
const gameConfig: Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: GAME_CONFIG.width,
  height: GAME_CONFIG.height,
  parent: 'game-container',
  backgroundColor: '#000000',
  scale: {
    mode: Phaser.Scale.FIT,
    autoCenter: Phaser.Scale.CENTER_BOTH,
    min: {
      width: GAME_CONFIG.width * 0.5,
      height: GAME_CONFIG.height * 0.5
    },
    max: {
      width: GAME_CONFIG.width * 2,
      height: GAME_CONFIG.height * 2
    }
  },
  physics: {
    default: 'arcade',
    arcade: {
      gravity: { x: 0, y: 0 },
      debug: false
    }
  },
  scene: [
    BootScene,
    PreloadScene,
    MenuScene,
    GameScene,
    GameOverScene
  ],
  pixelArt: true,
  antialias: false
};

// Initialize game when DOM is ready
window.addEventListener('DOMContentLoaded', () => {
  // Remove loading text
  const loadingElement = document.getElementById('loading');
  if (loadingElement) {
    loadingElement.style.display = 'none';
  }

  // Create and start the game
  const game = new LodeRunnerGame(gameConfig);
  
  // Add global game reference for debugging
  (window as any).game = game;
  
  console.log('Lode Runner Clone initialized!');
});