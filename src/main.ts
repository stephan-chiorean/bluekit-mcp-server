import * as readline from 'readline';

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

const KIT_DEFINITION = `A **kit** is a single markdown file that provides generic, modular instructions for building software components. It can include:

1. **Scope flexibility**: Can contain anything from:

   - Small, reusable components (UI components, backend utilities, etc.)

   - Larger features or flows

   - Entire applications (frontend, backend, or full-stack)

   - Any combination of the above

2. **Technology agnostic**: Works for:

   - Frontend components (UI elements, views, flows)

   - Backend components (APIs, services, utilities)

   - Full-stack applications

   - Any technology stack

3. **Modular and composable**: Each component is:

   - Self-contained with complete code and instructions

   - Selectable independently

   - Can be combined with other components

   - Includes dependencies and relationships

4. **AI-agent ready**: Designed to be used with Cursor or similar tools—point the agent at the kit and specify which components to build.

5. **Complete and self-contained**: Each component includes:

   - Full code implementations

   - File paths and structure

   - Dependencies between components

   - Build/setup instructions

   - Customization tokens

6. **Generic and reusable**: Not tied to a specific project—tokens can be replaced to adapt to different contexts.

In short: a kit is a modular, reusable instruction set for building software components of any size, from small utilities to entire applications, across frontend, backend, or full-stack.`;

const KITTIFY_GUIDE = `The **Kittify Guide** explains how to convert an existing project (or part of a project) into reusable BlueKit components.

A kittified project should break itself down into:
1. **Components** (atomic units of functionality)

2. **Features** (bundles of components)

3. **Flows** (end-to-end experiences)

4. **Systems** (larger architectural groupings)

Each kit produced during kittification must:

- Have a clear purpose and scope

- Include a complete implementation

- Include setup instructions

- Document all dependencies

- Be fully reusable in other contexts

- Optionally contain nested kits

Kittification is recursive:  

Large projects → features → components → utilities.  

Every unit may itself become a kit.

The goal is to create a structured, modular library of reusable building blocks that AI tools can assemble into new applications.`;

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

