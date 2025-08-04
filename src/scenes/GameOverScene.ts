import { Scene } from 'phaser';
import { SCENE_KEYS } from '@/config/GameConfig';

export class GameOverScene extends Scene {
  private finalScore = 0;
  private isHighScore = false;

  constructor() {
    super({ key: SCENE_KEYS.GAME_OVER });
  }

  init(data: { score: number; reason: 'won' | 'lost' }): void {
    this.finalScore = data.score || 0;
    this.isHighScore = this.checkHighScore(this.finalScore);
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#001122');
    
    this.createGameOverUI();
    this.setupInput();
  }

  private createGameOverUI(): void {
    const centerX = this.cameras.main.width / 2;
    const centerY = this.cameras.main.height / 2;

    this.add.text(centerX, centerY - 150, 'GAME OVER', {
      fontSize: '64px',
      color: '#ff0000',
      fontFamily: 'Arial, sans-serif',
      stroke: '#000000',
      strokeThickness: 4
    }).setOrigin(0.5);

    this.add.text(centerX, centerY - 50, `FINAL SCORE: ${this.finalScore}`, {
      fontSize: '32px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    if (this.isHighScore) {
      this.add.text(centerX, centerY, 'NEW HIGH SCORE!', {
        fontSize: '28px',
        color: '#ffff00',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5);
    }

    this.add.text(centerX, centerY + 100, 'Press SPACE to play again', {
      fontSize: '24px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);

    this.add.text(centerX, centerY + 140, 'Press ESC for main menu', {
      fontSize: '24px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
  }

  private setupInput(): void {
    this.input.keyboard!.on('keydown-SPACE', () => {
      this.scene.start(SCENE_KEYS.GAME);
    });

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  private checkHighScore(score: number): boolean {
    const highScore = localStorage.getItem('loderunner-highscore');
    if (!highScore || score > parseInt(highScore)) {
      localStorage.setItem('loderunner-highscore', score.toString());
      return true;
    }
    return false;
  }
}