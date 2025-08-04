import { Scene } from 'phaser';
import { SCENE_KEYS, GAME_CONFIG } from '@/config/GameConfig';
import { GameState } from '@/types/GameTypes';

export class GameScene extends Scene {
  private gameState!: GameState;
  private player!: Phaser.GameObjects.Rectangle;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private scoreText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private livesText!: Phaser.GameObjects.Text;

  constructor() {
    super({ key: SCENE_KEYS.GAME });
  }

  create(): void {
    this.initializeGameState();
    this.createLevel();
    this.createPlayer();
    this.createUI();
    this.setupInput();
  }

  private initializeGameState(): void {
    this.gameState = {
      currentLevel: 1,
      score: 0,
      lives: 3,
      goldCollected: 0,
      totalGold: 5
    };
  }

  private createLevel(): void {
    this.cameras.main.setBackgroundColor('#001122');
    
    // Create a simple test level layout
    const levelData = [
      '############################',
      '#                          #',
      '#  G    G    G    G    G   #',
      '#                          #',
      '############    ############',
      '#                          #',
      '#         HHHHH            #',
      '#         H   H            #',
      '#         H   H            #',
      '###########   ##############',
      '#                          #',
      '#                          #',
      '#    HHHHHHHHHHHHH         #',
      '#    H           H         #',
      '#    H           H         #',
      '#    H     P     H         #',
      '#    H           H         #',
      '######           ###########',
      '#                          #',
      '#                          #',
      '############################'
    ];

    levelData.forEach((row, y) => {
      for (let x = 0; x < row.length; x++) {
        const char = row[x];
        const pixelX = x * GAME_CONFIG.tileSize;
        const pixelY = y * GAME_CONFIG.tileSize;

        switch (char) {
          case '#':
            this.add.rectangle(pixelX + 16, pixelY + 16, GAME_CONFIG.tileSize, GAME_CONFIG.tileSize, 0x8B4513);
            break;
          case 'H':
            this.add.rectangle(pixelX + 16, pixelY + 16, 4, GAME_CONFIG.tileSize, 0xFFFF00);
            break;
          case 'G':
            const gold = this.add.circle(pixelX + 16, pixelY + 16, 8, 0xFFD700);
            gold.setData('type', 'gold');
            gold.setInteractive();
            break;
          case 'P':
            // Player starting position - will be set later
            this.registry.set('playerStart', { x: pixelX + 16, y: pixelY + 16 });
            break;
        }
      }
    });
  }

  private createPlayer(): void {
    const startPos = this.registry.get('playerStart') || { x: 400, y: 400 };
    
    this.player = this.add.rectangle(startPos.x, startPos.y, 24, 30, 0xFF6B6B);
    this.physics.add.existing(this.player);
    
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    playerBody.setCollideWorldBounds(true);
    playerBody.setSize(24, 30);
  }

  private createUI(): void {
    const padding = 20;
    
    this.scoreText = this.add.text(padding, padding, `SCORE: ${this.gameState.score}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.levelText = this.add.text(padding, padding + 30, `LEVEL: ${this.gameState.currentLevel}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.livesText = this.add.text(padding, padding + 60, `LIVES: ${this.gameState.lives}`, {
      fontSize: '24px',
      color: '#ffffff',
      fontFamily: 'Arial, sans-serif'
    });

    this.add.text(GAME_CONFIG.width - padding, padding, 
      `GOLD: ${this.gameState.goldCollected}/${this.gameState.totalGold}`, {
      fontSize: '24px',
      color: '#FFD700',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);

    this.add.text(GAME_CONFIG.width - padding, GAME_CONFIG.height - padding - 60, 
      'ESC - Menu', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);

    this.add.text(GAME_CONFIG.width - padding, GAME_CONFIG.height - padding - 30, 
      'Arrow Keys - Move', {
      fontSize: '18px',
      color: '#cccccc',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(1, 0);
  }

  private setupInput(): void {
    this.cursors = this.input.keyboard!.createCursorKeys();
    
    this.wasdKeys = this.input.keyboard!.addKeys('W,S,A,D,Z,X') as { [key: string]: Phaser.Input.Keyboard.Key };

    this.input.keyboard!.on('keydown-ESC', () => {
      this.scene.start(SCENE_KEYS.MENU);
    });
  }

  update(): void {
    this.handlePlayerMovement();
    this.updateUI();
  }

  private updateUI(): void {
    this.scoreText.setText(`SCORE: ${this.gameState.score}`);
    this.levelText.setText(`LEVEL: ${this.gameState.currentLevel}`);
    this.livesText.setText(`LIVES: ${this.gameState.lives}`);
  }

  private handlePlayerMovement(): void {
    const playerBody = this.player.body as Phaser.Physics.Arcade.Body;
    const speed = 200;

    playerBody.setVelocity(0);

    if (this.cursors.left.isDown || this.wasdKeys.A.isDown) {
      playerBody.setVelocityX(-speed);
    } else if (this.cursors.right.isDown || this.wasdKeys.D.isDown) {
      playerBody.setVelocityX(speed);
    }

    if (this.cursors.up.isDown || this.wasdKeys.W.isDown) {
      playerBody.setVelocityY(-speed);
    } else if (this.cursors.down.isDown || this.wasdKeys.S.isDown) {
      playerBody.setVelocityY(speed);
    }
  }
}