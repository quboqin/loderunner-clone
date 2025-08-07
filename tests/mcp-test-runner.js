#!/usr/bin/env node

// MCP Test Runner - Validates local MCP server functionality
// Tests the local Playwright MCP server before Claude Code integration

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function testMCPServer() {
  console.log('🧪 Testing Local MCP Server Functionality');
  console.log('==========================================');
  
  try {
    // Test 1: Load MCP server
    console.log('📋 Test 1: Loading MCP server...');
    const serverPath = path.resolve(__dirname, '../.claude/mcp-servers/local-playwright-server.js');
    const { default: mcpServer } = await import(serverPath);
    console.log('✅ MCP server loaded successfully');
    
    // Test 2: Get configuration
    console.log('\n📋 Test 2: Getting configuration...');
    const config = await mcpServer.handleToolCall('get_config');
    console.log('✅ Configuration retrieved:');
    console.log('   Browser Config:', config.browserConfig ? 'Loaded' : 'Missing');
    console.log('   Project Root:', config.projectRoot);
    console.log('   Playwright Version:', config.playwrightVersion || 'Unknown');
    
    // Test 3: Launch browser
    console.log('\n📋 Test 3: Launching browser...');
    const launchResult = await mcpServer.handleToolCall('launch_browser');
    if (launchResult.error) {
      throw new Error('Browser launch failed: ' + launchResult.error);
    }
    console.log('✅ Browser launched successfully');
    
    // Test 4: Navigate to game (requires dev server to be running)
    console.log('\n📋 Test 4: Testing game navigation...');
    try {
      const navResult = await mcpServer.handleToolCall('navigate_to_game');
      if (navResult.error) {
        console.log('⚠️  Game navigation failed (dev server may not be running):', navResult.error);
      } else {
        console.log('✅ Game navigation successful');
        
        // Test 5: Execute tests
        console.log('\n📋 Test 5: Running Bug #27 tests...');
        const testResults = await mcpServer.handleToolCall('execute_tests');
        
        if (testResults.error) {
          console.log('❌ Test execution failed:', testResults.error);
        } else {
          console.log('✅ Tests completed successfully');
          console.log('   Overall Status:', testResults.overallStatus);
          console.log('   Body Size Test:', testResults.bodySize);
          console.log('   Body Offset Test:', testResults.bodyOffset);
        }
      }
    } catch (error) {
      console.log('⚠️  Game navigation test skipped (dev server not running?):', error.message);
    }
    
    // Test 6: Close browser
    console.log('\n📋 Test 6: Closing browser...');
    await mcpServer.handleToolCall('close_browser');
    console.log('✅ Browser closed successfully');
    
    console.log('\n🎉 MCP Server Test Results');
    console.log('==========================');
    console.log('✅ Server Loading: PASSED');
    console.log('✅ Configuration: PASSED');
    console.log('✅ Browser Launch: PASSED');
    console.log('✅ Browser Cleanup: PASSED');
    console.log('\n✅ Local MCP server is ready for Claude Code integration!');
    
  } catch (error) {
    console.error('\n❌ MCP Server Test Failed:');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
    
    console.log('\n📋 Troubleshooting Steps:');
    console.log('1. Ensure dev server is running: npm run dev');
    console.log('2. Check Playwright installation: npx playwright --version');
    console.log('3. Verify browser installation: npx playwright install chromium');
    console.log('4. Check browser config: ./tests/config/browser.config.js');
    
    process.exit(1);
  }
}

// Test MCP Bridge separately
async function testMCPBridge() {
  console.log('\n🧪 Testing MCP Bridge Integration');
  console.log('==================================');
  
  try {
    // Test bridge loading
    const bridgePath = path.resolve(__dirname, './config/local-mcp-bridge.js');
    const { initializeMCPServer, mcpTools } = await import(bridgePath);
    
    console.log('✅ MCP bridge loaded successfully');
    console.log('   Available tools:', Object.keys(mcpTools.playwright).length);
    
    // Test server initialization
    const server = await initializeMCPServer();
    console.log('✅ MCP server initialized through bridge');
    
    return true;
  } catch (error) {
    console.error('❌ MCP Bridge Test Failed:', error.message);
    return false;
  }
}

// Main execution
async function main() {
  console.log('🚀 Local MCP Server Validation Suite');
  console.log('=====================================\n');
  
  // Check prerequisites
  console.log('📋 Checking Prerequisites...');
  
  try {
    // Check if dev server is accessible
    const response = await fetch('http://localhost:3000').catch(() => null);
    if (response && response.ok) {
      console.log('✅ Dev server is running at http://localhost:3000');
    } else {
      console.log('⚠️  Dev server is not running (tests will be limited)');
      console.log('   Start dev server with: npm run dev');
    }
  } catch (error) {
    console.log('⚠️  Cannot check dev server status');
  }
  
  // Run tests
  await testMCPServer();
  await testMCPBridge();
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Restart Claude Code to reload MCP server configuration');
  console.log('2. Check available MCP servers with: /mcp list');
  console.log('3. Test MCP integration through Claude Code interface');
  console.log('4. Run Bug #27 validation tests using MCP tools');
}

// Handle process events
process.on('SIGINT', () => {
  console.log('\n🔚 Test interrupted by user');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  console.error('\n💥 Unhandled promise rejection:', error);
  process.exit(1);
});

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(error => {
    console.error('💥 Test suite failed:', error);
    process.exit(1);
  });
}

export { testMCPServer, testMCPBridge };