// Direct Playwright Test Runner - Bypasses MCP server issues
// Tests Bug #27 collision detection fixes directly

import { chromium } from 'playwright';

async function runCollisionDetectionTests() {
  console.log('🚀 Starting Direct Playwright Bug #27 Tests');
  console.log('============================================');
  
  let browser = null;
  let page = null;
  
  try {
    // Launch browser with your installed chromium-1181
    console.log('🔧 Launching Chromium browser...');
    browser = await chromium.launch({ 
      headless: false,
      slowMo: 500 // Slow down for better observation
    });
    
    page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 720 });
    
    console.log('✅ Browser launched successfully');
    
    // Test 1: Navigate to game
    console.log('🎮 Navigating to game...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    
    // Wait for Phaser to load
    await page.waitForFunction(() => window.Phaser !== undefined, { timeout: 30000 });
    await page.waitForTimeout(3000); // Additional wait for game initialization
    
    console.log('✅ Game loaded successfully');
    
    // Test 2: Navigate to game scene (press ENTER to start)
    console.log('🎮 Starting the game (press ENTER to start game)...');
    await page.keyboard.press('Enter'); // Press ENTER to select "START GAME"
    await page.waitForTimeout(3000); // Wait for game scene to load and player to spawn
    
    // Test 3: Activate debug mode
    console.log('🔍 Activating debug mode (pressing D key)...');
    await page.keyboard.press('KeyD');
    await page.waitForTimeout(1000);
    
    // Test 3: Capture screenshot of debug mode
    await page.screenshot({ 
      path: './tests/screenshots/debug-mode-active.png', 
      fullPage: true 
    });
    console.log('📸 Debug mode screenshot saved');
    
    // Test 4: Extract debug information using page evaluation
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
    
    // Test 5: Validate Bug #27 fixes
    console.log('🧪 Validating Bug #27 fixes...');
    
    const testResults = {
      bodySize: 'UNKNOWN',
      bodyOffset: 'UNKNOWN',
      overallStatus: 'PARTIAL'
    };
    
    if (debugInfo.found && debugInfo.bodyWidth !== 'N/A') {
      // Body Size Test
      const expectedWidth = 16;
      const expectedHeight = 28;
      const actualWidth = debugInfo.bodyWidth;
      const actualHeight = debugInfo.bodyHeight;
      
      // Check for the old scaled values to detect if scaling issue was present
      const oldScaledWidth = 25.6;
      const oldScaledHeight = 44.8;
      const wasScaled = Math.abs(actualWidth - oldScaledWidth) < 0.1 && Math.abs(actualHeight - oldScaledHeight) < 0.1;
      
      if (Math.abs(actualWidth - expectedWidth) < 0.1 && 
          Math.abs(actualHeight - expectedHeight) < 0.1) {
        testResults.bodySize = 'PASSED';
        console.log('✅ Body Size Test PASSED: ' + actualWidth + 'x' + actualHeight);
        console.log('   ✅ Scaling issue resolved (was not ' + oldScaledWidth + 'x' + oldScaledHeight + ')');
      } else {
        testResults.bodySize = 'FAILED';
        console.log('❌ Body Size Test FAILED: Expected 16x28, Got ' + actualWidth + 'x' + actualHeight);
        if (wasScaled) {
          console.log('   ❌ Still showing old scaled values - scaling fix not applied');
        }
      }
      
      // Offset Test - expect compensated values (desired/1.6 = 8/1.6=5, 4/1.6=2.5)
      const expectedOffsetX = 5;    // 8 / 1.6 (compensated for sprite scale)
      const expectedOffsetY = 2.5;  // 4 / 1.6 (compensated for sprite scale)  
      const actualOffsetX = debugInfo.bodyOffsetX;
      const actualOffsetY = debugInfo.bodyOffsetY;
      
      // Check for the old uncompensated values that would show incorrectly scaled results
      const oldUncompensatedX = 8;    // Uncompensated desired value
      const oldUncompensatedY = 4;    // Uncompensated desired value  
      const offsetWasUncompensated = Math.abs(actualOffsetX - oldUncompensatedX) < 0.1 && Math.abs(actualOffsetY - oldUncompensatedY) < 0.1;
      
      if (Math.abs(actualOffsetX - expectedOffsetX) < 0.1 && 
          Math.abs(actualOffsetY - expectedOffsetY) < 0.1) {
        testResults.bodyOffset = 'PASSED';
        console.log('✅ Body Offset Test PASSED: (' + actualOffsetX + ',' + actualOffsetY + ')');
        console.log('   ✅ Scaling compensation working (compensated from desired 8,4 to actual 5,2.5)');
      } else {
        testResults.bodyOffset = 'FAILED';
        console.log('❌ Body Offset Test FAILED: Expected (5,2.5), Got (' + actualOffsetX + ',' + actualOffsetY + ')');
        if (offsetWasUncompensated) {
          console.log('   ❌ Using uncompensated values - offset scaling compensation not applied');
        }
      }
      
      // Additional Debug Information
      console.log('📊 Additional Debug Info:');
      console.log('   Player Position: (' + debugInfo.playerX + ',' + debugInfo.playerY + ')');
      console.log('   Body Center: (' + debugInfo.bodyCenterX + ',' + debugInfo.bodyCenterY + ')');
      console.log('   Sprite Scale: ' + debugInfo.spriteScale);
      console.log('   Gravity: ' + debugInfo.gravity);
      console.log('   Debug Mode Active: ' + debugInfo.debugMode);
      
      // Overall Status
      if (testResults.bodySize === 'PASSED' && testResults.bodyOffset === 'PASSED') {
        testResults.overallStatus = 'PASSED';
      } else {
        testResults.overallStatus = 'FAILED';
      }
    } else {
      console.log('⚠️  Could not extract debug information:');
      if (!debugInfo.found) {
        console.log('   Reason: ' + debugInfo.message);
        if (debugInfo.error) {
          console.log('   Error: ' + debugInfo.error);
        }
        if (debugInfo.sceneKeys) {
          console.log('   Available scenes: ' + debugInfo.sceneKeys.join(', '));
        }
      }
    }
    
    // Final Report
    console.log('\n📊 BUG #27 VALIDATION REPORT');
    console.log('============================');
    console.log('Overall Status: ' + testResults.overallStatus);
    console.log('Body Size Test: ' + testResults.bodySize);
    console.log('Body Offset Test: ' + testResults.bodyOffset);
    console.log('Browser Version: Chromium (Direct)');
    console.log('============================\n');
    
    // Keep browser open for 10 seconds for manual inspection
    console.log('🔍 Keeping browser open for 10 seconds for manual inspection...');
    console.log('   Please verify debug information is visible in the game');
    await page.waitForTimeout(10000);
    
    return testResults;
    
  } catch (error) {
    console.error('❌ Test execution failed:', error.message);
    return {
      overallStatus: 'ERROR',
      error: error.message
    };
  } finally {
    if (browser) {
      await browser.close();
      console.log('🔚 Browser closed');
    }
  }
}

// Execute the tests
runCollisionDetectionTests().then(results => {
  console.log('🏁 Test execution completed');
  process.exit(results.overallStatus === 'PASSED' ? 0 : 1);
}).catch(error => {
  console.error('💥 Fatal error:', error);
  process.exit(1);
});