// Helper functions for Phaser game testing

/**
 * Activates debug mode in the game by pressing the 'D' key
 * @param {Page} page - Playwright page object
 */
export async function activateDebugMode(page) {
  await page.keyboard.press('KeyD');
  await page.waitForTimeout(500); // Wait for debug mode to activate
}

/**
 * Extracts debug information from the game's debug display
 * @param {Page} page - Playwright page object
 * @returns {Object} Debug information including body size, offset, position, etc.
 */
export async function extractDebugInfo(page) {
  // Wait for debug text to be visible
  await page.waitForSelector('text=DEBUG MODE', { timeout: 5000 });
  
  // Extract debug text content
  const debugText = await page.evaluate(() => {
    // Look for debug text elements in the game
    const debugElements = document.querySelectorAll('*');
    for (const element of debugElements) {
      if (element.textContent?.includes('DEBUG MODE')) {
        return element.textContent;
      }
    }
    return null;
  });
  
  if (!debugText) {
    throw new Error('Debug information not found on page');
  }
  
  // Parse debug information
  const debugInfo = parseDebugText(debugText);
  return debugInfo;
}

/**
 * Parses the debug text to extract structured information
 * @param {string} debugText - Raw debug text from the game
 * @returns {Object} Parsed debug information
 */
function parseDebugText(debugText) {
  const info = {
    spriteCenter: null,
    spriteSize: null,
    bodyPosition: null,
    bodyCenter: null,
    bodySize: null,
    bodyOffset: null,
    velocity: null,
    gravity: null,
    blocked: null,
    onLadder: null,
    onRope: null
  };
  
  // Regular expressions to extract values
  const patterns = {
    spriteCenter: /Sprite Center \(x,y\): \(([0-9.]+), ([0-9.]+)\)/,
    spriteSize: /Sprite Size: ([0-9.]+) x ([0-9.]+)/,
    bodyPosition: /Body Position \(x,y\): \(([0-9.]+), ([0-9.]+)\)/,
    bodyCenter: /Body Center \(x,y\): \(([0-9.]+), ([0-9.]+)\)/,
    bodySize: /Body Size: ([0-9.]+) x ([0-9.]+)/,
    bodyOffset: /Body Offset: \(([0-9.]+), ([0-9.]+)\)/,
    velocity: /Velocity: \(([0-9.-]+), ([0-9.-]+)\)/,
    gravity: /Gravity: ([0-9]+)/,
    onLadder: /On Ladder: (true|false)/,
    onRope: /On Rope: (true|false)/
  };
  
  // Extract values using patterns
  for (const [key, pattern] of Object.entries(patterns)) {
    const match = debugText.match(pattern);
    if (match) {
      if (key === 'spriteCenter' || key === 'bodyPosition' || key === 'bodyCenter' || 
          key === 'spriteSize' || key === 'bodySize' || key === 'bodyOffset' || key === 'velocity') {
        info[key] = {
          x: parseFloat(match[1]),
          y: parseFloat(match[2])
        };
      } else if (key === 'gravity') {
        info[key] = parseInt(match[1]);
      } else if (key === 'onLadder' || key === 'onRope') {
        info[key] = match[1] === 'true';
      }
    }
  }
  
  return info;
}

/**
 * Validates that the player can move through a tile-height gap
 * @param {Page} page - Playwright page object
 * @param {Object} startPos - Starting position {x, y}
 * @param {Object} targetPos - Target position {x, y}
 */
export async function testCeilingClearance(page, startPos, targetPos) {
  // Move player to start position (this would require game-specific implementation)
  // For now, just simulate key presses
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
  await page.keyboard.press('ArrowRight');
  await page.waitForTimeout(100);
}

/**
 * Tests that gravity is properly applied to the player
 * @param {Page} page - Playwright page object
 */
export async function testGravityApplication(page) {
  const initialDebugInfo = await extractDebugInfo(page);
  
  // Wait a moment and check if player is falling
  await page.waitForTimeout(1000);
  const finalDebugInfo = await extractDebugInfo(page);
  
  // If player is in air, velocity.y should be > 0 (falling down)
  const isPlayerFalling = finalDebugInfo.velocity?.y > 0;
  
  return {
    initialVelocity: initialDebugInfo.velocity,
    finalVelocity: finalDebugInfo.velocity,
    isPlayerFalling,
    gravity: finalDebugInfo.gravity
  };
}

/**
 * Tests vertical movement restrictions (should only work on ladders)
 * @param {Page} page - Playwright page object
 */
export async function testVerticalMovementRestriction(page) {
  const initialDebugInfo = await extractDebugInfo(page);
  
  // Try to move up
  await page.keyboard.down('ArrowUp');
  await page.waitForTimeout(200);
  await page.keyboard.up('ArrowUp');
  
  const afterUpDebugInfo = await extractDebugInfo(page);
  
  // Player should not move up unless on ladder/rope
  const movedUp = afterUpDebugInfo.spriteCenter?.y < initialDebugInfo.spriteCenter?.y;
  const onClimbableSurface = initialDebugInfo.onLadder || initialDebugInfo.onRope;
  
  return {
    onLadder: initialDebugInfo.onLadder,
    onRope: initialDebugInfo.onRope,
    movedUp,
    shouldAllowVerticalMovement: onClimbableSurface,
    testPassed: onClimbableSurface ? movedUp : !movedUp
  };
}

/**
 * Waits for the game to fully load
 * @param {Page} page - Playwright page object
 */
export async function waitForGameToLoad(page) {
  // Wait for Phaser to initialize
  await page.waitForFunction(
    () => window.Phaser !== undefined,
    { timeout: 30000 }
  );
  
  // Wait a bit more for the game scene to be ready
  await page.waitForTimeout(2000);
}

/**
 * Takes a screenshot with timestamp for debugging
 * @param {Page} page - Playwright page object
 * @param {string} testName - Name of the test for file naming
 */
export async function takeDebugScreenshot(page, testName) {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `debug-${testName}-${timestamp}.png`;
  const path = `./tests/screenshots/${filename}`;
  
  await page.screenshot({ path, fullPage: true });
  return path;
}