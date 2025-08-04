import { Scene } from 'phaser';

export class InputManager {
  private scene: Scene;
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys!: { [key: string]: Phaser.Input.Keyboard.Key };
  private actionKeys!: { [key: string]: Phaser.Input.Keyboard.Key };

  constructor(scene: Scene) {
    this.scene = scene;
    this.setupInput();
  }

  private setupInput(): void {
    this.cursors = this.scene.input.keyboard!.createCursorKeys();
    
    this.wasdKeys = this.scene.input.keyboard!.addKeys('W,S,A,D') as { [key: string]: Phaser.Input.Keyboard.Key };
    
    this.actionKeys = this.scene.input.keyboard!.addKeys('Z,X,SPACE,ESC,ENTER') as { [key: string]: Phaser.Input.Keyboard.Key };
  }

  isLeftPressed(): boolean {
    return this.cursors.left.isDown || this.wasdKeys.A.isDown;
  }

  isRightPressed(): boolean {
    return this.cursors.right.isDown || this.wasdKeys.D.isDown;
  }

  isUpPressed(): boolean {
    return this.cursors.up.isDown || this.wasdKeys.W.isDown;
  }

  isDownPressed(): boolean {
    return this.cursors.down.isDown || this.wasdKeys.S.isDown;
  }

  isDigLeftPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.actionKeys.Z);
  }

  isDigRightPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.actionKeys.X);
  }

  isActionPressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.actionKeys.SPACE) || 
           Phaser.Input.Keyboard.JustDown(this.actionKeys.ENTER);
  }

  isEscapePressed(): boolean {
    return Phaser.Input.Keyboard.JustDown(this.actionKeys.ESC);
  }

  destroy(): void {
    // Cleanup if needed
  }
}