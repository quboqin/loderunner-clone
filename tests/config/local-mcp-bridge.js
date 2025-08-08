// Local MCP Bridge for Playwright Integration
// Bridges Claude Code MCP protocol with project's test suite

import { createRequire } from 'module';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const require = createRequire(import.meta.url);

// Import the local MCP server
const serverPath = path.resolve(__dirname, '../../.claude/mcp-servers/local-playwright-server.js');
let mcpServer;

async function initializeMCPServer() {
  if (!mcpServer) {
    const { default: server } = await import(serverPath);
    mcpServer = server;
  }
  return mcpServer;
}

// MCP Tools Export for Claude Code
export const mcpTools = {
  playwright: {
    name: 'playwright',
    description: 'Execute Phaser game tests using local Playwright installation',
    
    async launch_browser(args = {}) {
      const server = await initializeMCPServer();
      return await server.handleToolCall('launch_browser', args);
    },
    
    async navigate_to_game(args = {}) {
      const server = await initializeMCPServer();
      return await server.handleToolCall('navigate_to_game', args);
    },
    
    async execute_bug27_tests(args = {}) {
      const server = await initializeMCPServer();
      return await server.handleToolCall('execute_tests', args);
    },
    
    async close_browser(args = {}) {
      const server = await initializeMCPServer();
      return await server.handleToolCall('close_browser', args);
    },
    
    async get_configuration(args = {}) {
      const server = await initializeMCPServer();
      return await server.handleToolCall('get_config', args);
    }
  }
};

// Claude Code MCP Handler
async function handleMCPRequest(request) {
  try {
    console.log('🔧 MCP Request received:', request.method);
    
    const server = await initializeMCPServer();
    
    switch (request.method) {
      case 'initialize':
        return {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: 'local-playwright-bridge',
            version: '1.0.0'
          }
        };
        
      case 'tools/list':
        return {
          tools: [
            {
              name: 'launch_browser',
              description: 'Launch Chromium browser using project Playwright'
            },
            {
              name: 'navigate_to_game', 
              description: 'Navigate to the game and wait for Phaser to load'
            },
            {
              name: 'execute_bug27_tests',
              description: 'Run Bug #27 collision detection validation tests'
            },
            {
              name: 'close_browser',
              description: 'Close the browser and cleanup resources'
            },
            {
              name: 'get_configuration',
              description: 'Get current browser and project configuration'
            }
          ]
        };
        
      case 'tools/call':
        const { name: toolName, arguments: toolArgs } = request.params;
        const result = await server.handleToolCall(toolName, toolArgs);
        
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2)
            }
          ]
        };
        
      default:
        throw new Error(`Unknown MCP method: ${request.method}`);
    }
  } catch (error) {
    console.error('❌ MCP Request failed:', error);
    
    return {
      error: {
        code: -32603,
        message: error.message,
        data: {
          stack: error.stack
        }
      }
    };
  }
}

// MCP Server Protocol Implementation
if (process.argv.includes('--mcp')) {
  console.log('🤖 Local MCP Bridge Server Starting...');
  console.log('Connecting to project Playwright installation...');
  
  // Handle MCP protocol messages
  let messageBuffer = '';
  
  process.stdin.on('data', async (chunk) => {
    messageBuffer += chunk.toString();
    
    // Process complete JSON messages
    let newlineIndex;
    while ((newlineIndex = messageBuffer.indexOf('\n')) !== -1) {
      const line = messageBuffer.slice(0, newlineIndex);
      messageBuffer = messageBuffer.slice(newlineIndex + 1);
      
      if (line.trim()) {
        try {
          const request = JSON.parse(line);
          const response = await handleMCPRequest(request);
          
          const responseMessage = {
            jsonrpc: '2.0',
            id: request.id,
            ...response
          };
          
          console.log('📤 MCP Response:', responseMessage);
          process.stdout.write(JSON.stringify(responseMessage) + '\n');
          
        } catch (error) {
          console.error('❌ Failed to process MCP message:', error);
          
          const errorResponse = {
            jsonrpc: '2.0',
            id: null,
            error: {
              code: -32700,
              message: 'Parse error',
              data: error.message
            }
          };
          
          process.stdout.write(JSON.stringify(errorResponse) + '\n');
        }
      }
    }
  });
  
  // Send initialization message
  const initMessage = {
    jsonrpc: '2.0',
    method: 'initialized',
    params: {
      protocolVersion: '2024-11-05',
      capabilities: {
        tools: {}
      },
      serverInfo: {
        name: 'local-playwright-bridge',
        version: '1.0.0'
      }
    }
  };
  
  console.log('📡 Sending MCP initialization...');
  process.stdout.write(JSON.stringify(initMessage) + '\n');
}

export { handleMCPRequest, initializeMCPServer };