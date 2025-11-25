import * as readline from 'readline';
import { JsonRpcRequest, JsonRpcResponse, ToolCallResult } from './types.js';
import { BlueKitTools } from './BlueKitTools.js';

// ============================================================================
// MCP SERVER
// ============================================================================

class MCPServer {
  private readonly tools: BlueKitTools;

  constructor() {
    this.tools = new BlueKitTools();
  }

  handleRequest(request: JsonRpcRequest): JsonRpcResponse {
    switch (request.method) {
      case 'initialize':
        return this.handleInitialize(request);
      case 'tools/list':
        return this.handleToolsList(request);
      case 'tools/call':
        return this.handleToolsCall(request);
      default:
        return {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: `Method not found: ${request.method}`
          }
        };
    }
  }

  private handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        protocolVersion: '2024-11-05',
        capabilities: {
          tools: {}
        },
        serverInfo: {
          name: 'bluekit',
          version: '1.0.0'
        }
      }
    };
  }

  private handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: request.id,
      result: {
        tools: this.tools.getToolDefinitions()
      }
    };
  }

  private handleToolsCall(request: JsonRpcRequest): JsonRpcResponse {
    const params = request.params as { name: string; arguments?: Record<string, unknown> };
    
    if (!params || !params.name) {
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32602,
          message: 'Invalid params: tool name is required'
        }
      };
    }

    const toolName = params.name;
    const toolArgs = params.arguments || {};
    
    // Log tool call to stderr (won't interfere with JSON-RPC protocol)
    console.error(`[MCP] Tool call: ${toolName}`, JSON.stringify(toolArgs, null, 2));
    
    const handler = this.tools.getToolHandler(toolName);
    
    if (!handler) {
      console.error(`[MCP] Tool not found: ${toolName}`);
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32601,
          message: `Tool not found: ${toolName}`
        }
      };
    }

    try {
      const content = handler(toolArgs);
      const result: ToolCallResult = {
        content
      };
      console.error(`[MCP] Tool ${toolName} completed successfully`);
      return {
        jsonrpc: '2.0',
        id: request.id,
        result
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Internal error';
      console.error(`[MCP] Tool ${toolName} error:`, errorMessage);
      if (error instanceof Error && error.stack) {
        console.error(`[MCP] Stack trace:`, error.stack);
      }
      return {
        jsonrpc: '2.0',
        id: request.id,
        error: {
          code: -32603,
          message: errorMessage
        }
      };
    }
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

function main(): void {
  const server = new MCPServer();
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: false
  });

  rl.on('line', (line: string) => {
    if (line.trim().length === 0) {
      return;
    }

    try {
      const request = JSON.parse(line) as JsonRpcRequest;

      if (request.jsonrpc !== '2.0') {
        return;
      }

      // Log incoming request to stderr
      console.error(`[MCP] Request: ${request.method} (id: ${request.id})`);

      const response = server.handleRequest(request);
      
      // Log response to stderr
      console.error(`[MCP] Response: ${request.method} (id: ${request.id})`);
      
      // Send JSON-RPC response to stdout
      console.log(JSON.stringify(response));
    } catch (error) {
      // Log parsing errors to stderr
      console.error('[MCP] Error parsing request:', error instanceof Error ? error.message : 'Unknown error');
    }
  });
}

main();
