// Automated Test Runner for Phaser Lode Runner Clone
// Uses MCP Playwright server for browser automation

import { Bug27ValidationTests } from './e2e/collision-detection/bug27-validation.js';
import { browserConfig } from './config/browser.config.js';

/**
 * Main test execution function
 * This script will be called by the MCP Playwright server
 */
async function runAutomatedTests() {
  console.log('🎮 Starting Phaser Lode Runner Automated Tests');
  console.log('==============================================');
  
  let testResults = null;
  
  try {
    // Note: In MCP context, the page object will be provided by the Playwright server
    // For now, we'll create the test structure that can be executed by MCP
    
    console.log('📝 Test Configuration:');
    console.log(`   Game URL: ${browserConfig.gameUrl}`);
    console.log(`   Browser: ${browserConfig.browser}`);
    console.log(`   Viewport: ${browserConfig.viewport.width}x${browserConfig.viewport.height}`);
    console.log('');
    
    // This is the test plan that will be executed by MCP Playwright
    const testPlan = {
      setup: {
        url: browserConfig.gameUrl,
        viewport: browserConfig.viewport,
        waitForLoad: true
      },
      tests: [
        {
          name: 'Body Size Validation',
          description: 'Verify collision body is 16x28 pixels (not 25.6x44.8)',
          steps: [
            'Navigate to game',
            'Wait for game to load',
            'Press D key to activate debug mode',
            'Extract debug information',
            'Validate body size matches expected values'
          ]
        },
        {
          name: 'Offset Validation', 
          description: 'Verify collision body offset is (8,4) pixels (not (12.8,6.4))',
          steps: [
            'Extract debug information',
            'Validate body offset matches expected values'
          ]
        },
        {
          name: 'Gravity Application',
          description: 'Verify player falls with gravity = 800',
          steps: [
            'Check gravity setting in debug info',
            'Verify player velocity changes when falling'
          ]
        },
        {
          name: 'Vertical Movement Restriction',
          description: 'Verify up/down movement only works on ladders/ropes',
          steps: [
            'Test vertical movement in empty space',
            'Check onLadder and onRope states'
          ]
        }
      ],
      validation: {
        bodySize: { width: 16, height: 28 },
        bodyOffset: { x: 8, y: 4 },
        gravity: 800,
        verticalMovement: 'ladder_rope_only'
      }
    };
    
    console.log('📋 Test Plan Generated');
    console.log(`   Number of tests: ${testPlan.tests.length}`);
    console.log('   Tests to execute:');
    testPlan.tests.forEach((test, i) => {
      console.log(`   ${i + 1}. ${test.name}: ${test.description}`);
    });
    console.log('');
    
    // Return the test plan for MCP execution
    return {
      status: 'READY',
      testPlan: testPlan,
      message: 'Test plan ready for MCP Playwright execution'
    };
    
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    return {
      status: 'ERROR',
      error: error.message
    };
  }
}

/**
 * Execute validation with actual page object (called by MCP)
 */
async function executeWithPlaywright(page) {
  console.log('🤖 Executing tests with MCP Playwright...');
  
  try {
    // Navigate to game scene if not already there
    console.log('🎮 Starting the game (press ENTER to start game)...');
    await page.keyboard.press('Enter'); // Press ENTER to select "START GAME"
    await page.waitForTimeout(3000); // Wait for game scene to load and player to spawn
    
    // Create validator and run all tests
    const validator = new Bug27ValidationTests(page);
    const results = await validator.runAllTests();
    
    return results;
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    return {
      overallStatus: 'ERROR',
      error: error.message,
      stack: error.stack
    };
  }
}

/**
 * MCP-specific test execution with enhanced configuration
 */
async function executeWithMCPConfig(page) {
  console.log('🤖 Executing tests with MCP configuration...');
  
  try {
    // Import browser configuration
    const { browserConfig } = await import('./config/browser.config.js');
    
    // Navigate to game scene using config
    console.log(`🎮 Navigating to ${browserConfig.gameUrl}...`);
    await page.goto(browserConfig.gameUrl, { 
      waitUntil: 'networkidle',
      timeout: browserConfig.navigationTimeout 
    });
    
    // Wait for Phaser to load
    await page.waitForFunction(() => window.Phaser !== undefined, { 
      timeout: browserConfig.navigationTimeout 
    });
    await page.waitForTimeout(3000); // Additional wait for game initialization
    
    // Start the game (press ENTER to select "START GAME")
    console.log('🎮 Starting the game (press ENTER to start game)...');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(3000); // Wait for game scene to load
    
    // Activate debug mode
    console.log('🔍 Activating debug mode (pressing D key)...');
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(1000);
    
    // Take screenshot for verification
    if (browserConfig.screenshotOnFailure) {
      const screenshotPath = `${browserConfig.screenshotPath}mcp-debug-mode-active.png`;
      await page.screenshot({ 
        path: screenshotPath,
        fullPage: true 
      });
      console.log(`📸 Debug mode screenshot saved: ${screenshotPath}`);
    }
    
    // Extract debug information using enhanced method from direct test runner
    console.log('📊 Extracting debug information...');
    const debugInfo = await page.evaluate(() => {
      // Access Phaser game instance directly
      if (window.game) {
        try {
          // Get the game scene specifically (where player exists)
          let gameScene = null;
          const scenes = window.game.scene.scenes;
          
          // Look for the game scene first
          for (let i = 0; i < scenes.length; i++) {
            if (scenes[i].scene.key === 'game' && scenes[i].scene.isActive()) {
              gameScene = scenes[i];
              break;
            }
          }
          
          // If game scene not found or not active, look for any active scene with a player
          if (!gameScene) {
            for (let i = 0; i < scenes.length; i++) {
              if (scenes[i].scene.isActive() && scenes[i].player) {
                gameScene = scenes[i];
                break;
              }
            }
          }
          
          const activeScene = gameScene;
          
          if (activeScene && activeScene.player) {
            const player = activeScene.player;
            const body = player.body;
            
            // Extract all relevant debug information
            const debugData = {
              found: true,
              playerX: Math.round(player.x * 10) / 10,
              playerY: Math.round(player.y * 10) / 10,
              bodyWidth: body ? Math.round(body.width * 10) / 10 : 'N/A',
              bodyHeight: body ? Math.round(body.height * 10) / 10 : 'N/A',
              bodyOffsetX: body ? Math.round(body.offset.x * 10) / 10 : 'N/A',
              bodyOffsetY: body ? Math.round(body.offset.y * 10) / 10 : 'N/A',
              bodyCenterX: body ? Math.round(body.center.x * 10) / 10 : 'N/A',
              bodyCenterY: body ? Math.round(body.center.y * 10) / 10 : 'N/A',
              spriteScale: Math.round(player.scaleX * 10) / 10,
              gravity: body ? body.gravity.y : 'N/A',
              velocityY: body ? Math.round(body.velocity.y * 10) / 10 : 'N/A',
              onFloor: body ? body.onFloor() : 'N/A',
              debugMode: activeScene.debugMode !== undefined ? activeScene.debugMode : 'N/A',
              sceneKey: activeScene.scene.key
            };
            
            console.log('Extracted debug data:', debugData);
            return debugData;
          } else {
            return {
              found: false,
              message: 'Player object not found in active scene',
              sceneCount: scenes.length,
              sceneKeys: scenes.map(s => s.scene.key)
            };
          }
        } catch (e) {
          return {
            found: false,
            error: e.message,
            message: 'Error accessing game objects'
          };
        }
      }
      
      return {
        found: false,
        message: 'Phaser game instance not found on window object'
      };
    });
    
    console.log('📋 Debug Information Extracted:');
    console.log(JSON.stringify(debugInfo, null, 2));
    
    // Validate using Bug #27 configuration
    const testResults = {
      bodySize: 'UNKNOWN',
      bodyOffset: 'UNKNOWN',
      overallStatus: 'PARTIAL'
    };
    
    if (debugInfo.found && debugInfo.bodyWidth !== 'N/A') {
      // Use config values for validation
      const expectedWidth = browserConfig.bug27.expectedBodySize.width / browserConfig.bug27.spriteScale;
      const expectedHeight = browserConfig.bug27.expectedBodySize.height / browserConfig.bug27.spriteScale;
      const expectedOffsetX = browserConfig.bug27.expectedBodyOffset.x / browserConfig.bug27.spriteScale;
      const expectedOffsetY = browserConfig.bug27.expectedBodyOffset.y / browserConfig.bug27.spriteScale;
      
      // Body Size Test
      const actualWidth = debugInfo.bodyWidth;
      const actualHeight = debugInfo.bodyHeight;
      
      if (Math.abs(actualWidth - expectedWidth) < 0.1 && 
          Math.abs(actualHeight - expectedHeight) < 0.1) {
        testResults.bodySize = 'PASSED';
        console.log('✅ Body Size Test PASSED: ' + actualWidth + 'x' + actualHeight);
        console.log('   ✅ Scaling issue resolved');
      } else {
        testResults.bodySize = 'FAILED';
        console.log('❌ Body Size Test FAILED: Expected ' + expectedWidth + 'x' + expectedHeight + ', Got ' + actualWidth + 'x' + actualHeight);
      }
      
      // Body Offset Test
      const actualOffsetX = debugInfo.bodyOffsetX;
      const actualOffsetY = debugInfo.bodyOffsetY;
      
      if (Math.abs(actualOffsetX - expectedOffsetX) < 0.1 && 
          Math.abs(actualOffsetY - expectedOffsetY) < 0.1) {
        testResults.bodyOffset = 'PASSED';
        console.log('✅ Body Offset Test PASSED: (' + actualOffsetX + ',' + actualOffsetY + ')');
        console.log('   ✅ Scaling compensation working');
      } else {
        testResults.bodyOffset = 'FAILED';
        console.log('❌ Body Offset Test FAILED: Expected (' + expectedOffsetX + ',' + expectedOffsetY + '), Got (' + actualOffsetX + ',' + actualOffsetY + ')');
      }
      
      // Overall Status
      if (testResults.bodySize === 'PASSED' && testResults.bodyOffset === 'PASSED') {
        testResults.overallStatus = 'PASSED';
      } else {
        testResults.overallStatus = 'FAILED';
      }
      
      // Add debug info to results
      testResults.debugInfo = debugInfo;
      testResults.browserVersion = 'Chromium (MCP Local)';
    }
    
    // Final Report
    console.log('\n📊 BUG #27 MCP VALIDATION REPORT');
    console.log('============================');
    console.log(`Overall Status: ${testResults.overallStatus}`);
    console.log(`Body Size Test: ${testResults.bodySize}`);
    console.log(`Body Offset Test: ${testResults.bodyOffset}`);
    console.log(`Browser Version: ${testResults.browserVersion}`);
    console.log('============================\n');
    
    return testResults;
    
  } catch (error) {
    console.error('❌ MCP test execution failed:', error);
    return {
      overallStatus: 'ERROR',
      error: error.message,
      stack: error.stack
    };
  }
}

// Export for MCP usage
export { runAutomatedTests, executeWithPlaywright, executeWithMCPConfig };

// If running directly (for testing)
if (import.meta.url === `file://${process.argv[1]}`) {
  runAutomatedTests().then(result => {
    console.log('Test preparation complete:', result);
  });
}