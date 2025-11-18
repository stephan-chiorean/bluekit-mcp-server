import * as readline from 'readline';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

function main(): void {
  // Read lines from stdin
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

      let response: JsonRpcResponse;

      if (request.method === 'initialize') {
        response = {
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
      } else if (request.method === 'tools/list') {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          result: {
            tools: [
              {
                name: 'bluekit.ping',
                description: 'Health check for BlueKit MCP server',
                inputSchema: {
                  type: 'object',
                  properties: {},
                  required: []
                }
              }
            ]
          }
        };
      } else if (request.method === 'tools/call') {
        const params = request.params as { name: string; arguments?: Record<string, unknown> };
        
        if (params.name === 'bluekit.ping') {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            result: {
              content: [
                {
                  type: 'text',
                  text: 'pong from BlueKit!'
                }
              ]
            }
          };
        } else {
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: 'Method not found'
            }
          };
        }
      } else {
        response = {
          jsonrpc: '2.0',
          id: request.id,
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
      }

      console.log(JSON.stringify(response));
    } catch (error) {
      // Ignore invalid JSON
    }
  });
}

main();

