import { Scene } from 'phaser';
import { SCENE_KEYS } from '@/config/GameConfig';

export class MenuScene extends Scene {
  private selectedOption = 0;
  private menuOptions: Phaser.GameObjects.Text[] = [];
  private isInDialog = false;

  constructor() {
    super({ key: SCENE_KEYS.MENU });
  }

  create(): void {
    this.cameras.main.setBackgroundColor('#001122');
    
    // Reset state
    this.selectedOption = 0;
    this.menuOptions = [];
    this.isInDialog = false;
    
    this.createTitle();
    this.createMenu();
    this.setupInput();
    
  }

  private createTitle(): void {
    const centerX = this.cameras.main.width / 2;
    
    // Use authentic IBM logo if available, fallback to text
    if (this.textures.exists('logo')) {
      const logo = this.add.image(centerX, 180, 'logo');
      logo.setScale(2); // Scale up the logo
    } else {
      this.add.text(centerX, 150, 'LODE RUNNER', {
        fontSize: '64px',
        color: '#ffff00',
        fontFamily: 'Arial, sans-serif',
        stroke: '#000000',
        strokeThickness: 4
      }).setOrigin(0.5);

      this.add.text(centerX, 220, 'CLONE', {
        fontSize: '32px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5);
    }
  }

  private createMenu(): void {
    const centerX = this.cameras.main.width / 2;
    const startY = 320;
    const spacing = 60;

    const options = ['START GAME', 'INSTRUCTIONS', 'CREDITS'];
    
    options.forEach((option, index) => {
      const text = this.add.text(centerX, startY + (index * spacing), option, {
        fontSize: '28px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5);
      
      this.menuOptions.push(text);
    });

    this.updateMenuHighlight();
  }

  private setupInput(): void {
    
    this.input.keyboard!.on('keydown-UP', () => {
      this.selectedOption = Math.max(0, this.selectedOption - 1);
      this.updateMenuHighlight();
    });

    this.input.keyboard!.on('keydown-DOWN', () => {
      this.selectedOption = Math.min(this.menuOptions.length - 1, this.selectedOption + 1);
      this.updateMenuHighlight();
    });

    this.input.keyboard!.on('keydown-ENTER', () => {
      if (!this.isInDialog) {
        this.selectOption();
      }
    });

    this.input.keyboard!.on('keydown-SPACE', () => {
      if (!this.isInDialog) {
        this.selectOption();
      }
    });
  }

  private updateMenuHighlight(): void {
    if (!this.menuOptions || this.menuOptions.length === 0) {
      console.warn('MenuScene: menuOptions not initialized');
      return;
    }
    
    this.menuOptions.forEach((option, index) => {
      if (!option) {
        console.warn(`MenuScene: menu option at index ${index} is null`);
        return;
      }
      
      if (index === this.selectedOption) {
        option.setColor('#ffff00');
        option.setScale(1.1);
      } else {
        option.setColor('#ffffff');
        option.setScale(1);
      }
    });
  }

  private selectOption(): void {
    switch (this.selectedOption) {
      case 0: // START GAME
        this.scene.start(SCENE_KEYS.GAME);
        break;
      case 1: // INSTRUCTIONS
        this.showInstructions();
        break;
      case 2: // CREDITS
        this.showCredits();
        break;
    }
  }

  private showInstructions(): void {
    this.isInDialog = true;
    const centerX = this.cameras.main.width / 2;

    const instructions = this.add.group();
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(100, 150, this.cameras.main.width - 200, this.cameras.main.height - 300);
    instructions.add(bg);

    const title = this.add.text(centerX, 200, 'INSTRUCTIONS', {
      fontSize: '32px',
      color: '#ffff00',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
    instructions.add(title);

    const text = [
      'ARROW KEYS - Move player',
      'Z/X KEYS - Dig holes left/right',
      'COLLECT ALL GOLD to complete level',
      'AVOID ENEMIES - they will chase you!',
      '',
      'Press SPACE to return to menu'
    ];

    text.forEach((line, index) => {
      const lineText = this.add.text(centerX, 260 + (index * 30), line, {
        fontSize: '20px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5);
      instructions.add(lineText);
    });

    this.input.keyboard!.once('keydown-SPACE', () => {
      instructions.destroy(true);
      this.isInDialog = false;
    });
  }

  private showCredits(): void {
    this.isInDialog = true;
    const centerX = this.cameras.main.width / 2;

    const credits = this.add.group();
    
    const bg = this.add.graphics();
    bg.fillStyle(0x000000, 0.8);
    bg.fillRect(100, 200, this.cameras.main.width - 200, this.cameras.main.height - 400);
    credits.add(bg);

    const title = this.add.text(centerX, 250, 'CREDITS', {
      fontSize: '32px',
      color: '#ffff00',
      fontFamily: 'Arial, sans-serif'
    }).setOrigin(0.5);
    credits.add(title);

    const text = [
      'Original Lode Runner by Doug Smith (1983)',
      'Assets from Lode Runner Roku project',
      'Built with Phaser.js',
      '',
      'Press SPACE to return to menu'
    ];

    text.forEach((line, index) => {
      const lineText = this.add.text(centerX, 310 + (index * 30), line, {
        fontSize: '18px',
        color: '#ffffff',
        fontFamily: 'Arial, sans-serif'
      }).setOrigin(0.5);
      credits.add(lineText);
    });

    this.input.keyboard!.once('keydown-SPACE', () => {
      credits.destroy(true);
      this.isInDialog = false;
    });
  }
}