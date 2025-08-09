
export enum GuardState {
  IDLE = 'idle',
  RUNNING_LEFT = 'running_left', 
  RUNNING_RIGHT = 'running_right',
  CLIMBING = 'climbing',
  BAR_LEFT = 'bar_left',
  BAR_RIGHT = 'bar_right',
  FALLING = 'falling',
  IN_HOLE = 'in_hole',
  ESCAPING_HOLE = 'escaping_hole',
  REBORN = 'reborn',
  SHAKING = 'shaking'
}

export class Guard {
  public sprite: Phaser.Physics.Arcade.Sprite;
  private scene: Phaser.Scene;
  private state: GuardState = GuardState.IDLE;
  private targetPlayer: Phaser.GameObjects.Sprite;
  private lastDirection: number = 1; // 1 for right, -1 for left
  private speed: number = 80;
  
  // AI decision timing
  private decisionTimer: number = 0;
  private decisionInterval: number = 500; // Make decision every 500ms
  private lastDecisionTime: number = 0;
  
  // Hole mechanics
  private holeTimer: number = 0;
  private holeEscapeTime: number = 8000; // 8 seconds in hole before escaping
  private currentHole: string | null = null;
  
  // Pathfinding
  private pathfindingCooldown: number = 0;
  
  // Climbing state
  private onLadder: boolean = false;
  private onRope: boolean = false;
  
  constructor(scene: Phaser.Scene, x: number, y: number, targetPlayer: Phaser.GameObjects.Sprite) {
    this.scene = scene;
    this.targetPlayer = targetPlayer;
    
    // Create physics sprite
    this.sprite = scene.physics.add.sprite(x, y, 'guard', 'guard_00');
    this.sprite.setScale(1.6);
    this.sprite.setDepth(1000); // Same depth as player for proper layering
    
    // Set up physics body
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setSize(16, 28); // Similar to player collision size
    body.setOffset(2, -6); // Adjust offset for proper alignment
    body.setCollideWorldBounds(true);
    body.setGravityY(600); // Same gravity as player
    
    // Set bounce to prevent sticking to walls
    body.setBounce(0.1);
    
    this.setState(GuardState.IDLE);
  }
  
  update(_time: number, delta: number): void {
    this.decisionTimer += delta;
    this.pathfindingCooldown -= delta;
    
    
    // Handle hole mechanics
    if (this.state === GuardState.IN_HOLE) {
      this.holeTimer += delta;
      if (this.holeTimer >= this.holeEscapeTime) {
        this.escapeFromHole();
      }
      return; // Don't do other AI while in hole
    }
    
    // Make AI decisions periodically
    if (this.decisionTimer >= this.decisionInterval) {
      this.makeAIDecision();
      this.decisionTimer = 0;
    }
    
    // Execute current behavior
    this.executeBehavior();
    
    // Update animations based on movement
    this.updateAnimation();
  }
  
  private makeAIDecision(): void {
    if (this.state === GuardState.IN_HOLE || this.state === GuardState.REBORN) {
      return; // Don't make decisions in these states
    }
    
    const playerX = this.targetPlayer.x;
    const playerY = this.targetPlayer.y;
    const guardX = this.sprite.x;
    const guardY = this.sprite.y;
    
    const deltaX = playerX - guardX;
    const deltaY = playerY - guardY;
    
    
    // Enhanced AI: Handle vertical movement when player is on different level
    
    // Priority 1: If player is on different level, try to reach them vertically
    if (Math.abs(deltaY) > 40) { // Player is on different level
      // Try to climb if on ladder
      if (this.canClimb()) {
        if (deltaY < 0) { // Player is above
          this.setState(GuardState.CLIMBING);
          return; // Focus on climbing
        } else if (deltaY > 0) { // Player is below  
          this.setState(GuardState.CLIMBING);
          return; // Focus on climbing
        }
      }
      
      // Try to use rope if available
      if (this.canUseRope()) {
        if (deltaX > 0) {
          this.setState(GuardState.BAR_RIGHT);
          this.lastDirection = 1;
        } else {
          this.setState(GuardState.BAR_LEFT);
          this.lastDirection = -1;
        }
        return; // Focus on rope movement
      }
      
      // If can't climb or use rope, try to find ladder/rope horizontally
      // Move towards nearest ladder or rope (simplified: just move toward player horizontally)
    }
    
    // Priority 2: Horizontal movement towards player
    if (Math.abs(deltaX) > 20) { // Don't chase if very close
      if (deltaX > 0) {
        if (this.state !== GuardState.RUNNING_RIGHT) {
          this.setState(GuardState.RUNNING_RIGHT);
          this.lastDirection = 1;
        }
      } else {
        if (this.state !== GuardState.RUNNING_LEFT) {
          this.setState(GuardState.RUNNING_LEFT);
          this.lastDirection = -1;
        }
      }
    } else {
      if (this.state !== GuardState.IDLE) {
        this.setState(GuardState.IDLE);
      }
    }
  }
  
  private executeBehavior(): void {
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    
    switch (this.state) {
      case GuardState.IDLE:
        body.setVelocityX(0);
        break;
        
      case GuardState.RUNNING_LEFT:
        // Check if blocked by wall, if so, try to find alternative path
        if (body.blocked.left) {
          // Try to climb if possible
          if (this.onLadder) {
            this.setState(GuardState.CLIMBING);
            return;
          }
          // Otherwise, reverse direction temporarily
          this.setState(GuardState.RUNNING_RIGHT);
          return;
        }
        body.setVelocityX(-this.speed);
        break;
        
      case GuardState.RUNNING_RIGHT:
        // Check if blocked by wall, if so, try to find alternative path
        if (body.blocked.right) {
          // Try to climb if possible
          if (this.onLadder) {
            this.setState(GuardState.CLIMBING);
            return;
          }
          // Otherwise, reverse direction temporarily
          this.setState(GuardState.RUNNING_LEFT);
          return;
        }
        body.setVelocityX(this.speed);
        break;
        
      case GuardState.CLIMBING:
        // Set climbing velocity based on player position
        const playerY = this.targetPlayer.y;
        const guardY = this.sprite.y;
        const deltaY = playerY - guardY;
        
        body.setVelocityX(0); // No horizontal movement while climbing
        
        if (this.canClimb()) {
          if (Math.abs(deltaY) > 20) { // Still need to climb
            const climbSpeed = 60;
            if (deltaY < 0) {
              body.setVelocityY(-climbSpeed); // Climb up
            } else {
              body.setVelocityY(climbSpeed); // Climb down
            }
          } else {
            body.setVelocityY(0); // Stop climbing, close to player level
            this.setState(GuardState.IDLE);
          }
        } else {
          // No longer on ladder, stop climbing
          body.setVelocityY(0);
          this.setState(GuardState.FALLING);
        }
        break;
        
      case GuardState.BAR_LEFT:
        body.setVelocityX(-this.speed);
        body.setVelocityY(0);
        if (!this.canUseRope()) {
          this.setState(GuardState.FALLING);
        }
        break;
        
      case GuardState.BAR_RIGHT:
        body.setVelocityX(this.speed);
        body.setVelocityY(0);
        if (!this.canUseRope()) {
          this.setState(GuardState.FALLING);
        }
        break;
        
      case GuardState.FALLING:
        // Let physics handle falling
        if (body.blocked.down || body.touching.down) {
          this.setState(GuardState.IDLE);
        }
        break;
        
      case GuardState.IN_HOLE:
        body.setVelocity(0, 0);
        break;
        
      case GuardState.ESCAPING_HOLE:
        // Escape animation/movement handled separately
        break;
    }
  }
  
  private updateAnimation(): void {
    switch (this.state) {
      case GuardState.IDLE:
        this.sprite.anims.play('guard-idle', true);
        break;
        
      case GuardState.RUNNING_LEFT:
        this.sprite.anims.play('guard-run-left', true);
        break;
        
      case GuardState.RUNNING_RIGHT:
        this.sprite.anims.play('guard-run-right', true);
        break;
        
      case GuardState.CLIMBING:
        this.sprite.anims.play('guard-climb', true);
        break;
        
      case GuardState.BAR_LEFT:
        this.sprite.anims.play('guard-bar-left', true);
        break;
        
      case GuardState.BAR_RIGHT:
        this.sprite.anims.play('guard-bar-right', true);
        break;
        
      case GuardState.FALLING:
        if (this.lastDirection > 0) {
          this.sprite.anims.play('guard-fall-right', true);
        } else {
          this.sprite.anims.play('guard-fall-left', true);
        }
        break;
        
      case GuardState.IN_HOLE:
        if (this.lastDirection > 0) {
          this.sprite.anims.play('guard-shake-right', true);
        } else {
          this.sprite.anims.play('guard-shake-left', true);
        }
        break;
        
      case GuardState.REBORN:
        this.sprite.anims.play('guard-reborn', true);
        break;
    }
  }
  
  private setState(newState: GuardState): void {
    this.state = newState;
  }
  
  public getState(): GuardState {
    return this.state;
  }
  
  public getCurrentHole(): string | null {
    return this.currentHole;
  }
  
  public setClimbableState(ladder: boolean, rope: boolean): void {
    this.onLadder = ladder;
    this.onRope = rope;
  }
  
  // Check if guard can climb (on ladder)
  public canClimb(): boolean {
    return this.onLadder;
  }
  
  // Check if guard can use rope
  public canUseRope(): boolean {
    return this.onRope;
  }
  
  // Handle falling into hole
  public fallIntoHole(holeKey: string): void {
    // Don't trap guard if already in a hole
    if (this.state === GuardState.IN_HOLE) {
      return;
    }
    
    this.setState(GuardState.IN_HOLE);
    this.currentHole = holeKey;
    this.holeTimer = 0;
    
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(0); // No gravity while in hole
  }
  
  // Handle escaping from hole
  private escapeFromHole(): void {
    if (!this.currentHole) return;
    
    this.setState(GuardState.ESCAPING_HOLE);
    
    // Move guard back to spawn position (simple approach)
    // In a more complex implementation, this would find the nearest spawn point
    this.respawnAtStart();
  }
  
  // Check if guard can escape from hole (called when hole is about to fill)
  public attemptHoleEscape(): boolean {
    if (this.state !== GuardState.IN_HOLE) {
      return true; // Not in hole, so no problem
    }
    
    // Guard has been in hole for less than the escape time
    if (this.holeTimer < this.holeEscapeTime) {
      this.setState(GuardState.IDLE);
      this.currentHole = null;
      this.holeTimer = 0;
      
      // Restore normal physics
      const body = this.sprite.body as Phaser.Physics.Arcade.Body;
      body.setGravityY(600);
      
      return true; // Successfully escaped
    }
    
    return false; // Cannot escape, trapped
  }
  
  // Respawn guard at starting position
  private respawnAtStart(): void {
    this.setState(GuardState.REBORN);
    
    // Reset physics
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setGravityY(600);
    body.setVelocity(0, 0);
    
    // Reset timers
    this.holeTimer = 0;
    this.currentHole = null;
    
    // After reborn animation, return to idle
    this.sprite.on('animationcomplete-guard-reborn', () => {
      this.setState(GuardState.IDLE);
    }, this);
  }
  
  // Check collision with player
  public checkPlayerCollision(player: Phaser.GameObjects.Sprite): boolean {
    if (this.state === GuardState.IN_HOLE || this.state === GuardState.REBORN) {
      return false; // Can't collide in these states
    }
    
    const guardBounds = this.sprite.getBounds();
    const playerBounds = player.getBounds();
    
    const isColliding = Phaser.Geom.Rectangle.Overlaps(guardBounds, playerBounds);
    
    
    return isColliding;
  }
  
  // Set collision detection callbacks (to be called from GameScene)
  public setCollisionCallbacks(
    ladderGroup: Phaser.Physics.Arcade.StaticGroup,
    ropeGroup: Phaser.Physics.Arcade.StaticGroup,
    solidGroup: Phaser.Physics.Arcade.StaticGroup
  ): void {
    // Set up collision with solid tiles
    this.scene.physics.add.collider(this.sprite, solidGroup);
    
    // Set up overlap detection for ladders and ropes
    this.scene.physics.add.overlap(this.sprite, ladderGroup, this.onLadderOverlap, undefined, this.scene);
    this.scene.physics.add.overlap(this.sprite, ropeGroup, this.onRopeOverlap, undefined, this.scene);
  }
  
  private onLadderOverlap = (): void => {
    this.onLadder = true;
  }
  
  private onRopeOverlap = (): void => {
    this.onRope = true;
  }
  
  
  
  public reset(): void {
    // Reset all guard state to initial values
    this.setState(GuardState.IDLE);
    this.lastDirection = 1;
    this.decisionTimer = 0;
    this.pathfindingCooldown = 0;
    this.holeTimer = 0;
    this.currentHole = null;
    this.onLadder = false;
    this.onRope = false;
    
    // Reset physics body
    const body = this.sprite.body as Phaser.Physics.Arcade.Body;
    body.setVelocity(0, 0);
    body.setGravityY(600);
    
    // Reset sprite appearance
    this.sprite.setAlpha(1.0);
    
    // Force immediate AI decision on next update
    this.decisionTimer = this.decisionInterval; // This will trigger AI decision on next update
  }

  public destroy(): void {
    this.sprite.destroy();
  }
}