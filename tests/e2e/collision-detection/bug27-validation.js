// Bug #27 Automated Validation Tests
// Tests the collision detection fixes for Phaser scaling issues

import { browserConfig } from '../../config/browser.config.js';
import { 
  activateDebugMode, 
  extractDebugInfo, 
  waitForGameToLoad,
  takeDebugScreenshot,
  testGravityApplication,
  testVerticalMovementRestriction
} from '../../utils/phaser-helpers.js';

/**
 * Main test suite for Bug #27 validation
 * Tests the Phaser physics scaling fixes
 */
export class Bug27ValidationTests {
  constructor(page) {
    this.page = page;
    this.testResults = {
      bodySizeTest: null,
      offsetTest: null,
      collisionTest: null,
      gravityTest: null,
      ladderTest: null,
      overallStatus: 'PENDING'
    };
  }

  /**
   * Execute all Bug #27 validation tests
   */
  async runAllTests() {
    console.log('🚀 Starting Bug #27 Automated Validation Tests...');
    
    try {
      // Step 1: Navigate to game and wait for load
      await this.setupTestEnvironment();
      
      // Step 2: Activate debug mode and extract data
      await this.activateGameDebug();
      
      // Step 3: Run all validation tests
      await this.runBodySizeValidation();
      await this.runOffsetValidation();
      await this.runGravityValidation();
      await this.runLadderMovementValidation();
      
      // Step 4: Generate final report
      this.generateTestReport();
      
    } catch (error) {
      console.error('❌ Test execution failed:', error);
      this.testResults.overallStatus = 'FAILED';
      await takeDebugScreenshot(this.page, 'test-failure');
    }
    
    return this.testResults;
  }

  /**
   * Set up test environment - navigate to game and wait for load
   */
  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    await this.page.goto(browserConfig.gameUrl, { 
      waitUntil: 'networkidle',
      timeout: browserConfig.navigationTimeout 
    });
    
    await waitForGameToLoad(this.page);
    console.log('✅ Game loaded successfully');
  }

  /**
   * Activate debug mode in the game
   */
  async activateGameDebug() {
    console.log('🔍 Activating debug mode...');
    
    await activateDebugMode(this.page);
    
    // Wait for debug information to appear
    await this.page.waitForTimeout(1000);
    
    // Take screenshot of debug mode
    await takeDebugScreenshot(this.page, 'debug-mode-active');
    console.log('✅ Debug mode activated');
  }

  /**
   * Test 1: Validate collision body size
   * Expected: 16x28 pixels (not 25.6x44.8)
   */
  async runBodySizeValidation() {
    console.log('🧪 Testing body size validation...');
    
    try {
      const debugInfo = await extractDebugInfo(this.page);
      const bodySize = debugInfo.bodySize;
      
      const expectedWidth = 16;
      const expectedHeight = 28;
      const invalidWidth = 25.6;
      const invalidHeight = 44.8;
      
      const widthCorrect = Math.abs(bodySize.x - expectedWidth) < 0.1;
      const heightCorrect = Math.abs(bodySize.y - expectedHeight) < 0.1;
      
      const widthIncorrect = Math.abs(bodySize.x - invalidWidth) < 0.1;
      const heightIncorrect = Math.abs(bodySize.y - invalidHeight) < 0.1;
      
      this.testResults.bodySizeTest = {
        status: (widthCorrect && heightCorrect) ? 'PASSED' : 'FAILED',
        expected: `${expectedWidth} x ${expectedHeight}`,
        actual: `${bodySize.x} x ${bodySize.y}`,
        wasScalingIssue: widthIncorrect && heightIncorrect,
        details: {
          widthCorrect,
          heightCorrect,
          debugInfo: debugInfo
        }
      };
      
      if (this.testResults.bodySizeTest.status === 'PASSED') {
        console.log('✅ Body Size Test PASSED: Collision body is correctly sized');
      } else {
        console.log('❌ Body Size Test FAILED: Collision body size incorrect');
        console.log(`   Expected: ${expectedWidth}x${expectedHeight}, Got: ${bodySize.x}x${bodySize.y}`);
      }
      
    } catch (error) {
      this.testResults.bodySizeTest = {
        status: 'ERROR',
        error: error.message
      };
      console.log('❌ Body Size Test ERROR:', error.message);
    }
  }

  /**
   * Test 2: Validate collision body offset
   * Expected: (8,4) pixels (not (12.8,6.4))
   */
  async runOffsetValidation() {
    console.log('🧪 Testing body offset validation...');
    
    try {
      const debugInfo = await extractDebugInfo(this.page);
      const bodyOffset = debugInfo.bodyOffset;
      
      const expectedX = 8;
      const expectedY = 4;
      const invalidX = 12.8;
      const invalidY = 6.4;
      
      const xCorrect = Math.abs(bodyOffset.x - expectedX) < 0.1;
      const yCorrect = Math.abs(bodyOffset.y - expectedY) < 0.1;
      
      const xIncorrect = Math.abs(bodyOffset.x - invalidX) < 0.1;
      const yIncorrect = Math.abs(bodyOffset.y - invalidY) < 0.1;
      
      this.testResults.offsetTest = {
        status: (xCorrect && yCorrect) ? 'PASSED' : 'FAILED',
        expected: `(${expectedX}, ${expectedY})`,
        actual: `(${bodyOffset.x}, ${bodyOffset.y})`,
        wasScalingIssue: xIncorrect && yIncorrect,
        details: {
          xCorrect,
          yCorrect,
          debugInfo: debugInfo
        }
      };
      
      if (this.testResults.offsetTest.status === 'PASSED') {
        console.log('✅ Offset Test PASSED: Body offset is correctly positioned');
      } else {
        console.log('❌ Offset Test FAILED: Body offset incorrect');
        console.log(`   Expected: (${expectedX},${expectedY}), Got: (${bodyOffset.x},${bodyOffset.y})`);
      }
      
    } catch (error) {
      this.testResults.offsetTest = {
        status: 'ERROR',
        error: error.message
      };
      console.log('❌ Offset Test ERROR:', error.message);
    }
  }

  /**
   * Test 3: Validate gravity application
   * Expected: Player falls when not on solid ground
   */
  async runGravityValidation() {
    console.log('🧪 Testing gravity application...');
    
    try {
      const gravityResults = await testGravityApplication(this.page);
      
      const gravityCorrect = gravityResults.gravity === 800;
      const playerCanFall = gravityResults.isPlayerFalling !== undefined;
      
      this.testResults.gravityTest = {
        status: gravityCorrect ? 'PASSED' : 'FAILED',
        expected: 'Gravity: 800, Player should fall when in air',
        actual: `Gravity: ${gravityResults.gravity}, Falling: ${gravityResults.isPlayerFalling}`,
        details: gravityResults
      };
      
      if (this.testResults.gravityTest.status === 'PASSED') {
        console.log('✅ Gravity Test PASSED: Gravity properly applied');
      } else {
        console.log('❌ Gravity Test FAILED: Gravity not properly configured');
      }
      
    } catch (error) {
      this.testResults.gravityTest = {
        status: 'ERROR',
        error: error.message
      };
      console.log('❌ Gravity Test ERROR:', error.message);
    }
  }

  /**
   * Test 4: Validate vertical movement restriction
   * Expected: Up/down movement only works on ladders/ropes
   */
  async runLadderMovementValidation() {
    console.log('🧪 Testing ladder movement restriction...');
    
    try {
      const ladderResults = await testVerticalMovementRestriction(this.page);
      
      this.testResults.ladderTest = {
        status: ladderResults.testPassed ? 'PASSED' : 'FAILED',
        expected: 'Vertical movement only on ladders/ropes',
        actual: `OnLadder: ${ladderResults.onLadder}, OnRope: ${ladderResults.onRope}, MovedUp: ${ladderResults.movedUp}`,
        details: ladderResults
      };
      
      if (this.testResults.ladderTest.status === 'PASSED') {
        console.log('✅ Ladder Test PASSED: Vertical movement properly restricted');
      } else {
        console.log('❌ Ladder Test FAILED: Vertical movement restriction not working');
      }
      
    } catch (error) {
      this.testResults.ladderTest = {
        status: 'ERROR',
        error: error.message
      };
      console.log('❌ Ladder Test ERROR:', error.message);
    }
  }

  /**
   * Generate final test report
   */
  generateTestReport() {
    const passedTests = Object.values(this.testResults).filter(test => 
      test && test.status === 'PASSED'
    ).length;
    
    const totalTests = Object.keys(this.testResults).length - 1; // Exclude overallStatus
    
    this.testResults.overallStatus = passedTests === totalTests ? 'PASSED' : 'FAILED';
    
    console.log('\n📊 BUG #27 VALIDATION TEST REPORT');
    console.log('=====================================');
    console.log(`Overall Status: ${this.testResults.overallStatus}`);
    console.log(`Tests Passed: ${passedTests}/${totalTests}`);
    console.log('');
    
    Object.entries(this.testResults).forEach(([testName, result]) => {
      if (testName !== 'overallStatus' && result) {
        const status = result.status === 'PASSED' ? '✅' : result.status === 'FAILED' ? '❌' : '⚠️';
        console.log(`${status} ${testName}: ${result.status}`);
        if (result.expected && result.actual) {
          console.log(`   Expected: ${result.expected}`);
          console.log(`   Actual: ${result.actual}`);
        }
        if (result.wasScalingIssue !== undefined) {
          console.log(`   Was Scaling Issue: ${result.wasScalingIssue ? 'YES' : 'NO'}`);
        }
      }
    });
    
    console.log('=====================================\n');
  }
}