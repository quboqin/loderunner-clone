/**
 * ClimbValidation utility for checking if guards can climb out of holes
 * Implements Rule 5: If the Hole where the Guard is located is on the Y-layer 
 * at the Tile granularity, and the coordinates are (X, Y), if the positions 
 * (X + 1, Y - 1) or (X - 1, Y - 1) on the Y - 1 layer can be stood on, 
 * the Guard can climb up.
 */

// Utility for checking if guards can climb out of holes based on tile positions

export interface ClimbExitPoint {
  x: number;        // Grid X coordinate
  y: number;        // Grid Y coordinate
  direction: 'left' | 'right'; // Which direction the climb exit is
  isValid: boolean; // Whether this exit point is standable
}

export interface TileChecker {
  isTileStandable(gridX: number, gridY: number): boolean;
  isTileSolid(gridX: number, gridY: number): boolean;
  getTileType(gridX: number, gridY: number): number;
}

export class ClimbValidation {
  private tileChecker: TileChecker;

  constructor(tileChecker: TileChecker) {
    this.tileChecker = tileChecker;
  }

  /**
   * Check if a guard can climb out of a hole at given coordinates
   * @param holeGridX Hole X coordinate in grid units
   * @param holeGridY Hole Y coordinate in grid units
   * @returns Array of valid climb exit points
   */
  getValidClimbExits(holeGridX: number, holeGridY: number): ClimbExitPoint[] {
    const exits: ClimbExitPoint[] = [];

    // Check left exit: (X - 1, Y - 1)
    const leftExit = this.validateClimbExit(holeGridX - 1, holeGridY - 1, 'left');
    exits.push(leftExit);

    // Check right exit: (X + 1, Y - 1) 
    const rightExit = this.validateClimbExit(holeGridX + 1, holeGridY - 1, 'right');
    exits.push(rightExit);

    return exits;
  }

  /**
   * Check if any climb exit is available
   */
  canClimbOut(holeGridX: number, holeGridY: number): boolean {
    const exits = this.getValidClimbExits(holeGridX, holeGridY);
    return exits.some(exit => exit.isValid);
  }

  /**
   * Get the best climb exit (prefer right, then left)
   */
  getBestClimbExit(holeGridX: number, holeGridY: number): ClimbExitPoint | null {
    const exits = this.getValidClimbExits(holeGridX, holeGridY);
    
    // Prefer right exit, then left exit
    const rightExit = exits.find(e => e.direction === 'right' && e.isValid);
    if (rightExit) return rightExit;

    const leftExit = exits.find(e => e.direction === 'left' && e.isValid);
    if (leftExit) return leftExit;

    return null;
  }

  /**
   * Validate a specific climb exit point
   */
  private validateClimbExit(gridX: number, gridY: number, direction: 'left' | 'right'): ClimbExitPoint {
    const exit: ClimbExitPoint = {
      x: gridX,
      y: gridY,
      direction,
      isValid: false
    };

    // Check if the exit position is standable
    if (this.isTileStandable(gridX, gridY)) {
      // Additional validation: ensure there's a solid tile below to stand on
      const belowTileStandable = this.isTileStandable(gridX, gridY + 1) || 
                                 this.tileChecker.isTileSolid(gridX, gridY + 1);
      
      if (belowTileStandable) {
        exit.isValid = true;
      }
    }

    return exit;
  }

  /**
   * Check if a tile position is standable (not solid, not in hole)
   */
  private isTileStandable(gridX: number, gridY: number): boolean {
    // Use the injected tile checker to determine if tile is standable
    return this.tileChecker.isTileStandable(gridX, gridY);
  }

  /**
   * Check if guard has a clear path to climb to exit point
   * @param holeGridX Current hole X position
   * @param holeGridY Current hole Y position  
   * @param exitPoint Target exit point
   */
  hasClimbPath(holeGridX: number, holeGridY: number, exitPoint: ClimbExitPoint): boolean {
    if (!exitPoint.isValid) {
      return false;
    }

    // Check if there are any obstacles between hole and exit point
    const deltaX = exitPoint.x - holeGridX;
    const deltaY = exitPoint.y - holeGridY;

    // For climbing out of holes, we expect deltaY to be -1 (moving up one level)
    if (deltaY !== -1) {
      return false;
    }

    // Check if horizontal movement path is clear
    if (Math.abs(deltaX) === 1) {
      // Direct adjacent climb - check if the intermediate position is passable
      const intermediateX = holeGridX + (deltaX > 0 ? 1 : -1);
      const intermediateY = holeGridY;
      
      // The intermediate position should be passable (not solid)
      return !this.tileChecker.isTileSolid(intermediateX, intermediateY);
    }

    return false;
  }

  /**
   * Check if multiple guards can climb out of the same hole
   * @param holeGridX Hole X coordinate
   * @param holeGridY Hole Y coordinate
   * @param guardCount Number of guards in hole
   */
  canMultipleGuardsClimb(holeGridX: number, holeGridY: number, guardCount: number): boolean {
    if (guardCount <= 1) {
      return this.canClimbOut(holeGridX, holeGridY);
    }

    const exits = this.getValidClimbExits(holeGridX, holeGridY);
    const validExits = exits.filter(e => e.isValid);

    // Multiple guards can climb if there are multiple valid exits or
    // if guards can stack and climb sequentially
    return validExits.length > 0;
  }

  /**
   * Get debug information about climb possibilities
   */
  getClimbDebugInfo(holeGridX: number, holeGridY: number): string[] {
    const info: string[] = [];
    const exits = this.getValidClimbExits(holeGridX, holeGridY);

    info.push(`Climb validation for hole at (${holeGridX}, ${holeGridY}):`);
    
    for (const exit of exits) {
      const status = exit.isValid ? 'VALID' : 'BLOCKED';
      info.push(`  ${exit.direction.toUpperCase()} exit (${exit.x}, ${exit.y}): ${status}`);
      
      if (!exit.isValid) {
        // Provide reason why exit is blocked
        const tileStandable = this.isTileStandable(exit.x, exit.y);
        const belowSolid = this.tileChecker.isTileSolid(exit.x, exit.y + 1);
        info.push(`    - Standable: ${tileStandable}, Below solid: ${belowSolid}`);
      }
    }

    const canClimb = exits.some(e => e.isValid);
    info.push(`  Overall climb possible: ${canClimb ? 'YES' : 'NO'}`);

    return info;
  }
}