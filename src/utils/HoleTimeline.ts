/**
 * HoleTimeline utility class for tracking hole and guard timing relationships
 * Implements the timeline rules specified in the game design:
 * - t1: Hole creation time
 * - t2: Hole close time (t2 = t1 + n)
 * - tg1: Guard fall time
 * - Timing-based guard death logic: if tg1 + m >= t2, guard dies
 */

export interface HoleTimelineData {
  t1: number;          // Hole creation timestamp
  t2: number;          // Hole close timestamp (t1 + n seconds)
  n: number;           // Hole duration in milliseconds
  holeKey: string;     // Hole identifier (gridX,gridY)
  guardsInHole: GuardTimelineEntry[];
}

export interface GuardTimelineEntry {
  guardId: string;     // Unique guard identifier
  tg1: number;         // Guard fall timestamp
  stunEndTime: number; // When guard can start climbing (tg1 + m)
  isStunned: boolean;  // Whether guard is currently stunned/fainting
  canClimb: boolean;   // Whether guard can attempt to climb out
}

export class HoleTimeline {
  private timelines: Map<string, HoleTimelineData> = new Map();
  private currentTime: number = 0;

  /**
   * Create a new hole timeline
   * @param holeKey Hole identifier (gridX,gridY)
   * @param creationTime Current game time (t1)
   * @param duration Hole duration in milliseconds (n)
   */
  createHoleTimeline(holeKey: string, creationTime: number, duration: number): HoleTimelineData {
    const timeline: HoleTimelineData = {
      t1: creationTime,
      t2: creationTime + duration,
      n: duration,
      holeKey,
      guardsInHole: []
    };

    this.timelines.set(holeKey, timeline);
    return timeline;
  }

  /**
   * Add a guard to a hole's timeline
   * @param holeKey Hole identifier
   * @param guardId Guard identifier
   * @param fallTime Guard fall timestamp (tg1)
   * @param stunDuration Stun duration in milliseconds (m)
   */
  addGuardToHole(holeKey: string, guardId: string, fallTime: number, stunDuration: number): boolean {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return false;
    }

    // Check if guard is already in this hole
    const existingGuard = timeline.guardsInHole.find(g => g.guardId === guardId);
    if (existingGuard) {
      return false;
    }

    const guardEntry: GuardTimelineEntry = {
      guardId,
      tg1: fallTime,
      stunEndTime: fallTime + stunDuration,
      isStunned: true,
      canClimb: false
    };

    timeline.guardsInHole.push(guardEntry);
    return true;
  }

  /**
   * Remove guard from hole timeline (when they escape or die)
   */
  removeGuardFromHole(holeKey: string, guardId: string): boolean {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return false;
    }

    const guardIndex = timeline.guardsInHole.findIndex(g => g.guardId === guardId);
    if (guardIndex === -1) {
      return false;
    }

    timeline.guardsInHole.splice(guardIndex, 1);
    return true;
  }

  /**
   * Update timeline states based on current time
   * @param currentTime Current game timestamp
   */
  update(currentTime: number): void {
    this.currentTime = currentTime;

    // Track holes to delete after processing
    const holesToDelete: string[] = [];

    for (const [holeKey, timeline] of this.timelines) {
      // Update guard states in this hole
      for (const guard of timeline.guardsInHole) {
        // Check if guard is no longer stunned
        if (guard.isStunned && currentTime >= guard.stunEndTime) {
          guard.isStunned = false;
          guard.canClimb = true;
        }
      }

      // Mark expired holes for deletion ONLY if no guards are in them
      // Add 100ms grace period after hole closes to allow death checks
      if (currentTime >= timeline.t2 + 100) {
        // Only delete if no guards are trapped in this hole
        if (timeline.guardsInHole.length === 0) {
          holesToDelete.push(holeKey);
        }
      }
    }

    // Delete holes that are safe to remove
    for (const holeKey of holesToDelete) {
      this.timelines.delete(holeKey);
    }
  }

  /**
   * Check if guard should die based on timeline rule 7:
   * If tg1 + m >= t2, the guard will be killed
   * @param holeKey Hole identifier
   * @param guardId Guard identifier
   * @param stunDuration Stun duration (m)
   * @returns true if guard should die, false if can potentially escape
   */
  shouldGuardDie(holeKey: string, guardId: string, stunDuration: number): boolean {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return true; // If hole doesn't exist, guard should die
    }

    const guard = timeline.guardsInHole.find(g => g.guardId === guardId);
    if (!guard) {
      return true; // Guard not in hole, shouldn't happen but safe default
    }

    // Rule 7: If tg1 + m >= t2, guard dies
    const guardRecoveryTime = guard.tg1 + stunDuration;
    return guardRecoveryTime >= timeline.t2;
  }

  /**
   * Get remaining time until hole closes
   */
  getRemainingHoleTime(holeKey: string): number {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return 0;
    }

    return Math.max(0, timeline.t2 - this.currentTime);
  }

  /**
   * Get remaining stun time for a guard
   */
  getRemainingStunTime(holeKey: string, guardId: string): number {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return 0;
    }

    const guard = timeline.guardsInHole.find(g => g.guardId === guardId);
    if (!guard) {
      return 0;
    }

    return Math.max(0, guard.stunEndTime - this.currentTime);
  }

  /**
   * Check if guard can attempt to climb out
   */
  canGuardClimb(holeKey: string, guardId: string): boolean {
    const timeline = this.timelines.get(holeKey);
    if (!timeline) {
      return false;
    }

    const guard = timeline.guardsInHole.find(g => g.guardId === guardId);
    if (!guard) {
      return false;
    }

    return guard.canClimb && !guard.isStunned;
  }

  /**
   * Get all guards in a specific hole
   */
  getGuardsInHole(holeKey: string): GuardTimelineEntry[] {
    const timeline = this.timelines.get(holeKey);
    return timeline ? [...timeline.guardsInHole] : [];
  }

  /**
   * Get timeline data for a hole
   */
  getHoleTimeline(holeKey: string): HoleTimelineData | null {
    return this.timelines.get(holeKey) || null;
  }

  /**
   * Check if hole exists and is still active
   */
  isHoleActive(holeKey: string): boolean {
    const timeline = this.timelines.get(holeKey);
    return timeline ? this.currentTime < timeline.t2 : false;
  }

  /**
   * Clean up expired timelines
   */
  cleanup(): void {
    for (const [holeKey, timeline] of this.timelines) {
      if (this.currentTime >= timeline.t2) {
        this.timelines.delete(holeKey);
      }
    }
  }

  /**
   * Get all active hole timelines for external processing
   * @returns Map of holeKey to HoleTimelineData for all active holes
   */
  getAllActiveTimelines(): Map<string, HoleTimelineData> {
    return new Map(this.timelines);
  }

  /**
   * Get debug information for all active timelines
   */
  getDebugInfo(): string[] {
    const info: string[] = [];
    
    for (const [holeKey, timeline] of this.timelines) {
      const remainingTime = (timeline.t2 - this.currentTime) / 1000;
      info.push(`Hole ${holeKey}: ${remainingTime.toFixed(1)}s remaining`);
      
      for (const guard of timeline.guardsInHole) {
        const stunTime = Math.max(0, guard.stunEndTime - this.currentTime) / 1000;
        const status = guard.isStunned ? `stunned (${stunTime.toFixed(1)}s)` : 'can climb';
        info.push(`  Guard ${guard.guardId}: ${status}`);
      }
    }

    return info;
  }
}