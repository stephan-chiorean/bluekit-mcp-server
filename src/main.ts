import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import { loadPrompt } from './promptLoader';

// ============================================================================
// INTERFACES
// ============================================================================

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

interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
}

interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

type ToolHandler = (params: Record<string, unknown>) => Array<{ type: 'text'; text: string }>;

// ============================================================================
// CONSTANTS
// ============================================================================

const KIT_DEFINITION = loadPrompt('kits/kit-definition.md');
const KITTIFY_GUIDE = loadPrompt('kits/kittify-guide.md');

// ============================================================================
// IN-MEMORY STORE
// ============================================================================

const linkedProjects: string[] = [];

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const TOOL_DEFINITIONS: ToolDefinition[] = [
  {
    name: 'bluekit.ping',
    description: 'Health check for BlueKit MCP server',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'bluekit.linkProject',
    description: 'Link a project path to BlueKit',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: { type: 'string' }
      },
      required: ['projectPath']
    }
  },
  {
    name: 'bluekit.getKitDefinition',
    description: 'Get the full Kit Definition text',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'bluekit.getKittifyGuide',
    description: 'Get the full Kittify Guide text',
    inputSchema: {
      type: 'object',
      properties: {},
      required: []
    }
  },
  {
    name: 'bluekit.magic',
    description: 'Write a .magic.md file in the specified directory',
    inputSchema: {
      type: 'object',
      properties: {
        directory: { type: 'string', description: 'Directory path where the file should be written' }
      },
      required: ['directory']
    }
  }
];

// ============================================================================
// TOOL HANDLERS
// ============================================================================

const toolHandlers: Record<string, ToolHandler> = {
  'bluekit.ping': () => {
    return [
      { type: 'text', text: 'pong from BlueKit!' }
    ];
  },

  'bluekit.linkProject': (params: Record<string, unknown>) => {
    const projectPath = params.projectPath as string;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    // Store project path in memory
    if (!linkedProjects.includes(projectPath)) {
      linkedProjects.push(projectPath);
    }

    // Build response content
    const confirmation = `✅ Project linked successfully!`;
    const pathInfo = `📁 Project Path: ${projectPath}`;
    const kitDefSection = `\n\n📘 Kit Definition:\n\n${KIT_DEFINITION}`;
    const guideSection = `\n\n📗 Kittify Guide:\n\n${KITTIFY_GUIDE}`;

    return [
      {
        type: 'text',
        text: `${confirmation}\n\n${pathInfo}${kitDefSection}${guideSection}`
      }
    ];
  },

  'bluekit.getKitDefinition': () => {
    return [
      { type: 'text', text: KIT_DEFINITION }
    ];
  },

  'bluekit.getKittifyGuide': () => {
    return [
      { type: 'text', text: KITTIFY_GUIDE }
    ];
  },

  'bluekit.magic': (params: Record<string, unknown>) => {
    const directory = params.directory as string;
    
    if (!directory || typeof directory !== 'string') {
      throw new Error('directory is required and must be a string');
    }

    const resolvedDir = path.resolve(directory);
    const filePath = path.join(resolvedDir, '.magic.md');
    const content = 'this was magic';

    try {
      // Ensure directory exists
      if (!fs.existsSync(resolvedDir)) {
        throw new Error(`Directory does not exist: ${resolvedDir}`);
      }

      // Write the file
      fs.writeFileSync(filePath, content, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Created .magic.md file at: ${filePath}\n\nContent: ${content}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to write .magic.md file: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
};

// ============================================================================
// REQUEST HANDLERS
// ============================================================================

function handleInitialize(request: JsonRpcRequest): JsonRpcResponse {
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

function handleToolsList(request: JsonRpcRequest): JsonRpcResponse {
  return {
    jsonrpc: '2.0',
    id: request.id,
    result: {
      tools: TOOL_DEFINITIONS
    }
  };
}

function handleToolsCall(request: JsonRpcRequest): JsonRpcResponse {
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

  const handler = toolHandlers[toolName];
  
  if (!handler) {
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
    return {
      jsonrpc: '2.0',
      id: request.id,
      result
    };
  } catch (error) {
    return {
      jsonrpc: '2.0',
      id: request.id,
      error: {
        code: -32603,
        message: error instanceof Error ? error.message : 'Internal error'
      }
    };
  }
}

// ============================================================================
// MAIN LOOP
// ============================================================================

function main(): void {
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

      switch (request.method) {
        case 'initialize':
          response = handleInitialize(request);
          break;
        case 'tools/list':
          response = handleToolsList(request);
          break;
        case 'tools/call':
          response = handleToolsCall(request);
          break;
        default:
          response = {
            jsonrpc: '2.0',
            id: request.id,
            error: {
              code: -32601,
              message: `Method not found: ${request.method}`
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

