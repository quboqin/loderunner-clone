#!/usr/bin/env node

import { chromium } from 'playwright';
import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import project's browser configuration
const projectRoot = path.resolve(__dirname, '../..');
const browserConfigPath = path.join(projectRoot, 'tests/config/browser.config.js');

let browserConfig;
try {
  const { browserConfig: config } = await import(browserConfigPath);
  browserConfig = config;
} catch (error) {
  console.error('Failed to load browser config:', error);
  // Fallback configuration
  browserConfig = {
    browser: 'chromium',
    headless: false,
    viewport: { width: 1280, height: 720 },
    gameUrl: 'http://localhost:3000',
    slowMo: 100
  };
}

class LocalPlaywrightMCPServer {
  constructor() {
    this.browser = null;
    this.page = null;
    this.projectRoot = projectRoot;
  }

  async launchBrowser() {
    try {
      console.log('🚀 Launching Chromium with local Playwright...');
      console.log(`Project root: ${this.projectRoot}`);
      console.log(`Browser config: ${JSON.stringify(browserConfig, null, 2)}`);

      // Use project's Playwright installation
      this.browser = await chromium.launch({
        headless: browserConfig.headless || false,
        slowMo: browserConfig.slowMo || 100,
        args: [
          '--disable-web-security',
          '--disable-features=VizDisplayCompositor',
          '--no-sandbox'  // For better compatibility
        ]
      });

      this.page = await this.browser.newPage({
        viewport: browserConfig.viewport || { width: 1280, height: 720 }
      });

      // Set timeout from config
      if (browserConfig.navigationTimeout) {
        this.page.setDefaultTimeout(browserConfig.navigationTimeout);
      }

      console.log('✅ Browser launched successfully');
      return { browser: this.browser, page: this.page };
    } catch (error) {
      console.error('❌ Failed to launch browser:', error);
      throw error;
    }
  }

  async navigateToGame() {
    if (!this.page) {
      throw new Error('Browser not launched. Call launchBrowser() first.');
    }

    try {
      console.log(`🎮 Navigating to game: ${browserConfig.gameUrl}`);
      await this.page.goto(browserConfig.gameUrl, { 
        waitUntil: 'networkidle',
        timeout: browserConfig.navigationTimeout || 30000
      });
      
      // Wait for Phaser to load
      await this.page.waitForFunction(() => window.Phaser !== undefined, { 
        timeout: 30000 
      });
      
      console.log('✅ Game loaded successfully');
      return true;
    } catch (error) {
      console.error('❌ Failed to navigate to game:', error);
      throw error;
    }
  }

  async executeTests() {
    try {
      console.log('🧪 Executing Bug #27 validation tests...');
      
      if (!this.page) {
        await this.launchBrowser();
      }
      
      await this.navigateToGame();
      
      // Import and execute the test suite with MCP configuration
      const testModulePath = path.join(this.projectRoot, 'tests/run-automated-tests.js');
      const { executeWithMCPConfig } = await import(testModulePath);
      
      const results = await executeWithMCPConfig(this.page);
      
      console.log('✅ Tests completed successfully');
      return results;
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      throw error;
    }
  }

  async closeBrowser() {
    if (this.browser) {
      console.log('🔚 Closing browser...');
      await this.browser.close();
      this.browser = null;
      this.page = null;
    }
  }

  // MCP Protocol Methods
  async handleToolCall(tool, args) {
    try {
      switch (tool) {
        case 'launch_browser':
          return await this.launchBrowser();
        
        case 'navigate_to_game':
          return await this.navigateToGame();
        
        case 'execute_tests':
          return await this.executeTests();
        
        case 'close_browser':
          return await this.closeBrowser();
        
        case 'get_config':
          return {
            browserConfig,
            projectRoot: this.projectRoot,
            playwrightVersion: require('playwright/package.json').version
          };
        
        default:
          throw new Error(`Unknown tool: ${tool}`);
      }
    } catch (error) {
      return {
        error: error.message,
        stack: error.stack
      };
    }
  }
}

// MCP Server Implementation
const server = new LocalPlaywrightMCPServer();

// Handle process events
process.on('SIGINT', async () => {
  console.log('Received SIGINT, closing browser...');
  await server.closeBrowser();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('Received SIGTERM, closing browser...');
  await server.closeBrowser();
  process.exit(0);
});

// MCP Communication Handler
if (process.argv.includes('--mcp-mode')) {
  console.log('🤖 Starting Local Playwright MCP Server');
  console.log(`Using Playwright from: ${projectRoot}/node_modules/playwright`);
  
  // Simple MCP protocol handler for testing
  process.stdin.on('data', async (data) => {
    try {
      const request = JSON.parse(data.toString());
      const result = await server.handleToolCall(request.tool, request.args);
      
      const response = {
        id: request.id,
        result: result
      };
      
      process.stdout.write(JSON.stringify(response) + '\n');
    } catch (error) {
      const errorResponse = {
        id: request?.id || 'unknown',
        error: {
          message: error.message,
          stack: error.stack
        }
      };
      
      process.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  });
} else {
  // Direct execution for testing
  console.log('🧪 Running in test mode...');
  
  (async () => {
    try {
      const config = await server.handleToolCall('get_config');
      console.log('Configuration loaded:', config);
      
      await server.handleToolCall('launch_browser');
      console.log('Browser launched successfully');
      
      // Don't auto-run tests in standalone mode
      console.log('Ready for test execution. Use executeTests() to run tests.');
      
    } catch (error) {
      console.error('Test mode failed:', error);
    }
  })();
}

export default server;