/**
 * Environment-aware logging system for Lode Runner Clone
 * Follows 2024 Phaser 3 best practices for clean production code
 */

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

export enum LogCategory {
  GAME_STATE = 'GAME_STATE',
  LEVEL_LOADING = 'LEVEL_LOADING', 
  PLAYER_MOVEMENT = 'PLAYER_MOVEMENT',
  GUARD_AI = 'GUARD_AI',
  GUARD_COLLISION = 'GUARD_COLLISION',
  HOLE_MECHANICS = 'HOLE_MECHANICS',
  PHYSICS = 'PHYSICS',
  INPUT = 'INPUT',
  AUDIO = 'AUDIO',
  UI = 'UI'
}

interface LogConfig {
  enabled: boolean;
  minLevel: LogLevel;
  categories: Set<LogCategory>;
}

class LoggerService {
  private config: LogConfig;

  constructor() {
    // Environment-aware configuration
    const isDevelopment = process.env.NODE_ENV === 'development' || 
                         typeof window !== 'undefined' && (window as any).DEBUG_MODE;
    
    this.config = {
      enabled: isDevelopment,
      minLevel: isDevelopment ? LogLevel.DEBUG : LogLevel.ERROR,
      categories: new Set(Object.values(LogCategory))
    };
  }

  /**
   * Configure logging for specific categories and levels
   */
  configure(config: Partial<LogConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Enable/disable specific log categories
   */
  setCategories(categories: LogCategory[]): void {
    this.config.categories = new Set(categories);
  }

  /**
   * Log debug information (development only)
   */
  debug(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.DEBUG, category, message, ...args);
  }

  /**
   * Log informational messages
   */
  info(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.INFO, category, message, ...args);
  }

  /**
   * Log warnings
   */
  warn(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.WARN, category, message, ...args);
  }

  /**
   * Log errors (always logged regardless of environment)
   */
  error(category: LogCategory, message: string, ...args: any[]): void {
    this.log(LogLevel.ERROR, category, message, ...args);
  }

  /**
   * Internal logging method with filtering
   */
  private log(level: LogLevel, category: LogCategory, message: string, ...args: any[]): void {
    // Always log errors, regardless of configuration
    if (level === LogLevel.ERROR) {
      console.error(`[${category}] ${message}`, ...args);
      return;
    }

    // Check if logging is enabled and meets level/category requirements
    if (!this.config.enabled || 
        level < this.config.minLevel || 
        !this.config.categories.has(category)) {
      return;
    }

    // Format message with category and appropriate console method
    const formattedMessage = `[${category}] ${message}`;
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(formattedMessage, ...args);
        break;
      case LogLevel.INFO:
        console.info(formattedMessage, ...args);
        break;
      case LogLevel.WARN:
        console.warn(formattedMessage, ...args);
        break;
    }
  }

  /**
   * Create a scoped logger for a specific category
   */
  createCategoryLogger(category: LogCategory) {
    return {
      debug: (message: string, ...args: any[]) => this.debug(category, message, ...args),
      info: (message: string, ...args: any[]) => this.info(category, message, ...args),
      warn: (message: string, ...args: any[]) => this.warn(category, message, ...args),
      error: (message: string, ...args: any[]) => this.error(category, message, ...args)
    };
  }
}

// Singleton instance
export const Logger = new LoggerService();

// Convenience exports for common categories
export const GameLogger = Logger.createCategoryLogger(LogCategory.GAME_STATE);
export const LevelLogger = Logger.createCategoryLogger(LogCategory.LEVEL_LOADING);
export const PlayerLogger = Logger.createCategoryLogger(LogCategory.PLAYER_MOVEMENT);
export const GuardLogger = Logger.createCategoryLogger(LogCategory.GUARD_AI);
export const PhysicsLogger = Logger.createCategoryLogger(LogCategory.PHYSICS);