import * as readline from 'readline';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { loadPrompt } from './promptLoader.js';

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

const KIT_DEFINITION = loadPrompt('get-kit-definition.md');
const KITTIFY_GUIDE = loadPrompt('get-kittify-guide.md');

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
    name: 'bluekit.createKit',
    description: 'Generate a kit from a user description. Takes what the user wants to containerize and provides instructions for creating reusable kit instructions that can be injected into new apps. This is the primary tool for kit generation - it analyzes the user request and returns the kit definition and kittify guide as context for generating the actual kit content.',
    inputSchema: {
      type: 'object',
      properties: {
        description: {
          type: 'string',
          description: 'User description of what they want to containerize into a kit (e.g., "create a kit for my authentication system", "generate kits for all my UI components", "kittify my payment flow")'
        },
        projectPath: {
          type: 'string',
          description: 'Optional path to the project directory to analyze. If not provided, uses current working directory.'
        }
      },
      required: ['description']
    }
  },
  {
    name: 'bluekit.generateKit',
    description: 'Create a kit file in .bluekit directory with the generated content. Use this after bluekit.createKit has provided the context and kit content has been generated.',
    inputSchema: {
      type: 'object',
      properties: {
        name: { 
          type: 'string',
          description: 'Name of the kit'
        },
        content: {
          type: 'string',
          description: 'Kit content (markdown)'
        }
      },
      required: ['name', 'content']
    }
  },
  {
    name: 'bluekit.batchExecute',
    description: 'Execute multiple tool operations in sequence (single approval)',
    inputSchema: {
      type: 'object',
      properties: {
        tasks: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              params: { type: 'object' }
            },
            required: ['name', 'params']
          }
        }
      },
      required: ['tasks']
    }
  },
  {
    name: 'bluekit.init_project',
    description: 'Initialize a BlueKit project by linking it to the BlueKit store. Creates ~/.bluekit directory and projectRegistry.json if needed.',
    inputSchema: {
      type: 'object',
      properties: {
        projectPath: {
          type: 'string',
          description: 'Path to the project directory to initialize'
        },
        confirm: {
          type: 'boolean',
          description: 'Confirm creation of ~/.bluekit directory if it does not exist'
        }
      },
      required: ['projectPath']
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

  'bluekit.createKit': (params: Record<string, unknown>) => {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();
    
    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    // Return the kit definition and kittify guide as context
    // along with instructions for generating the kit
    const instructions = `# Kit Generation Instructions

## User Request
${description}

## Context for Kit Generation

### Kit Definition
${KIT_DEFINITION}

### Kittify Guide
${KITTIFY_GUIDE}

## Your Task

Based on the user's description above, analyze what they want to containerize and generate a complete kit that:

1. **Extracts the essence** of what the user wants to containerize
2. **Creates modular, reusable instructions** that can be injected into new apps
3. **Follows the Kit Definition** structure (components, features, flows, or systems)
4. **Follows the Kittify Guide** principles (break down into components, features, flows, systems)
5. **Is technology agnostic** and uses tokens for customization
6. **Is complete and self-contained** with full implementations, file paths, dependencies, and setup instructions

## Project Context
Project path: ${projectPath}

## Next Steps

After generating the kit content, use the \`bluekit.generateKit\` tool to save it with an appropriate name.`;

    return [
      { type: 'text', text: instructions }
    ];
  },

  'bluekit.generateKit': (params: Record<string, unknown>) => {
    const name = params.name as string;
    const content = params.content as string;
    
    if (!name || typeof name !== 'string') {
      throw new Error('name is required and must be a string');
    }

    if (!content || typeof content !== 'string') {
      throw new Error('content is required and must be a string');
    }

    const bluekitDir = path.resolve('.bluekit');

    try {
      if (!fs.existsSync(bluekitDir)) {
        fs.mkdirSync(bluekitDir, { recursive: true });
      }

      const kitPath = path.join(bluekitDir, `${name}.md`);
      fs.writeFileSync(kitPath, content, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Created kit: .bluekit/${name}.md`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate kit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  'bluekit.batchExecute': (params: Record<string, unknown>) => {
    const tasks = params.tasks as Array<{ name: string; params: Record<string, unknown> }>;
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('tasks is required and must be a non-empty array');
    }

    const results: Array<{ task: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const task of tasks) {
      if (!task.name || typeof task.name !== 'string') {
        results.push({
          task: 'unknown',
          success: false,
          error: 'Task name is required and must be a string'
        });
        continue;
      }

      if (!task.params || typeof task.params !== 'object') {
        results.push({
          task: task.name,
          success: false,
          error: 'Task params is required and must be a object'
        });
        continue;
      }

      const toolHandler = toolHandlers[task.name];

      if (!toolHandler) {
        results.push({
          task: task.name,
          success: false,
          error: `Tool not found: ${task.name}`
        });
        continue;
      }

      try {
        const result = toolHandler(task.params);
        results.push({
          task: task.name,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          task: task.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return [
      {
        type: 'text',
        text: `✅ Batch: ${successCount} succeeded, ${failureCount} failed\n\n${JSON.stringify(results, null, 2)}`
      }
    ];
  },

  'bluekit.init_project': (params: Record<string, unknown>) => {
    const projectPath = params.projectPath as string;
    const confirm = params.confirm as boolean | undefined;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    // Resolve the home directory and construct ~/.bluekit path
    const homeDir = os.homedir();
    const bluekitStoreDir = path.join(homeDir, '.bluekit');
    const registryPath = path.join(bluekitStoreDir, 'projectRegistry.json');

    // Check if ~/.bluekit directory exists
    if (!fs.existsSync(bluekitStoreDir)) {
      // If confirm is not true, return a message asking for confirmation
      if (confirm !== true) {
        return [
          {
            type: 'text',
            text: `⚠️  The BlueKit store directory (~/.bluekit) does not exist.\n\n` +
                  `Creating this directory will link the current project to your BlueKit store.\n` +
                  `This allows the BlueKit desktop app to discover and manage your projects.\n\n` +
                  `Project path: ${projectPath}\n\n` +
                  `To proceed, run the command again with --confirm flag, or answer 'yes' when prompted.`
          }
        ];
      }

      // Create the directory
      try {
        fs.mkdirSync(bluekitStoreDir, { recursive: true });
      } catch (error) {
        throw new Error(`Failed to create ~/.bluekit directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    // Read or create projectRegistry.json
    let registry: Array<{ id: string; title?: string; description?: string; path: string }> = [];
    
    if (fs.existsSync(registryPath)) {
      try {
        const registryContent = fs.readFileSync(registryPath, 'utf8');
        registry = JSON.parse(registryContent);
        
        // Validate it's an array
        if (!Array.isArray(registry)) {
          registry = [];
        }
      } catch (error) {
        // If file is corrupted, start fresh
        registry = [];
      }
    }

    // Check if project is already in registry
    const normalizedProjectPath = path.resolve(projectPath);
    const existingIndex = registry.findIndex(p => path.resolve(p.path) === normalizedProjectPath);

    if (existingIndex >= 0) {
      // Project already exists, update it
      const projectName = path.basename(projectPath);
      registry[existingIndex] = {
        id: registry[existingIndex].id,
        title: registry[existingIndex].title || projectName,
        description: registry[existingIndex].description,
        path: normalizedProjectPath
      };
    } else {
      // Add new project to registry
      const projectName = path.basename(projectPath);
      const newProject = {
        id: Date.now().toString(),
        title: projectName,
        description: '',
        path: normalizedProjectPath
      };
      registry.push(newProject);
    }

    // Write the registry back to file
    try {
      fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
    } catch (error) {
      throw new Error(`Failed to write projectRegistry.json: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    const action = existingIndex >= 0 ? 'updated' : 'added';
    return [
      {
        type: 'text',
        text: `✅ Project ${action} to BlueKit store!\n\n` +
              `Registry location: ${registryPath}\n` +
              `Project path: ${normalizedProjectPath}\n` +
              `Total projects in registry: ${registry.length}`
      }
    ];
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
