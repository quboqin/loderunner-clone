// Browser configuration for Playwright testing
export const browserConfig = {
  // Browser settings
  browser: 'chromium',
  headless: false, // Set to true for CI/CD
  viewport: { width: 1280, height: 720 },
  
  // Game-specific settings
  gameUrl: 'http://localhost:3000',
  debugKey: 'KeyD',
  
  // Timeouts
  navigationTimeout: 30000,
  waitTimeout: 5000,
  
  // Test settings
  slowMo: 100, // Slow down actions for debugging
  
  // Screenshot settings
  screenshotOnFailure: true,
  screenshotPath: './tests/screenshots/',
  
  // MCP-specific configuration
  mcp: {
    useLocalPlaywright: true,
    serverMode: 'local-bridge',
    playwrightPath: './node_modules/.bin/playwright',
    browsersPath: './node_modules/playwright/.local-browsers',
    executablePath: null, // Auto-detect Chromium location
    
    // MCP server settings
    serverScript: './.claude/mcp-servers/local-playwright-server.js',
    bridgeScript: './tests/config/local-mcp-bridge.js',
    
    // Launch options for MCP server
    launchOptions: {
      headless: false,
      slowMo: 100,
      devtools: false,
      args: [
        '--disable-web-security',
        '--disable-features=VizDisplayCompositor',
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage'
      ]
    },
    
    // Protocol settings
    protocol: {
      version: '2024-11-05',
      timeout: 60000,
      retries: 3
    }
  },
  
  // Bug #27 specific test configuration
  bug27: {
    expectedBodySize: { width: 16, height: 28 },
    expectedBodyOffset: { x: 5, y: 2.5 }, // Compensated values (8/1.6, 4/1.6)
    expectedGravity: 800,
    spriteScale: 1.6,
    
    // Old incorrect values (for validation)
    invalidBodySize: { width: 25.6, height: 44.8 },
    invalidBodyOffset: { x: 8, y: 4 }, // Uncompensated values
    
    // Test scenarios
    testScenarios: [
      'body_size_validation',
      'body_offset_validation', 
      'gravity_application',
      'vertical_movement_restriction',
      'collision_detection'
    ]
  }
};

export default browserConfig;