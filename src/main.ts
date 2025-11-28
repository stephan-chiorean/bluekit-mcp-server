import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { BlueKitTools } from './BlueKitTools.js';

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// MCP SERVER
// ============================================================================

class BluekitMCPServer {
  private readonly server: Server;
  private readonly tools: BlueKitTools;
  private readonly promptsDir: string;

  constructor() {
    this.tools = new BlueKitTools();
    this.promptsDir = path.join(__dirname, '..', 'bluekit-prompts');

    this.server = new Server(
      {
        name: 'bluekit',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
          resources: {},
        },
        instructions: `BlueKit MCP Server - AI-assisted development artifact management

## Available Resources (Definitions)
Read these resources to understand how to generate each artifact type:
- bluekit://prompts/get-agent-definition.md - Learn about Agent structure and requirements
- bluekit://prompts/get-blueprint-definition.md - Learn about Blueprint JSON structure
- bluekit://prompts/get-kit-definition.md - Learn about Kit structure and requirements
- bluekit://prompts/get-walkthrough-definition.md - Learn about Walkthrough structure and requirements

## Workflow for Generating Artifacts

### To Generate a Kit:
1. Read the resource: bluekit://prompts/get-kit-definition.md
2. Generate the kit content based on the definition
3. Call bluekit_kit_generateKit with name, content, and projectPath

### To Generate a Walkthrough:
1. Read the resource: bluekit://prompts/get-walkthrough-definition.md
2. Generate the walkthrough content based on the definition
3. Call bluekit_walkthrough_generateWalkthrough with name, content, and projectPath

### To Generate an Agent:
1. Read the resource: bluekit://prompts/get-agent-definition.md
2. Generate the agent content based on the definition (include YAML front matter with type: agent)
3. Call bluekit_agent_generateAgent with name, content, and projectPath

### To Generate a Blueprint:
1. Read the resource: bluekit://prompts/get-blueprint-definition.md
2. Generate the blueprint JSON structure
3. Call bluekit_blueprint_generateBlueprint with the blueprint object

## Other Tools
- bluekit_blueprint_listBlueprints - List all blueprints in global registry
- bluekit_blueprint_getBlueprint - Get a specific blueprint by ID
- bluekit_init_project - Initialize a .bluekit directory in a project
- bluekit_ping - Health check

Always read the appropriate definition resource first to understand the structure before generating content.`,
      }
    );

    this.setupHandlers();
  }

  private setupHandlers(): void {
    // Tools list handler
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.tools.getToolDefinitions(),
    }));

    // Tools call handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const toolArgs = (request.params.arguments || {}) as Record<string, unknown>;

      console.error(`[MCP] Tool call: ${toolName}`, JSON.stringify(toolArgs, null, 2));

      const handler = this.tools.getToolHandler(toolName);

      if (!handler) {
        console.error(`[MCP] Tool not found: ${toolName}`);
        throw new Error(`Tool not found: ${toolName}`);
      }

      try {
        const content = handler(toolArgs);
        console.error(`[MCP] Tool ${toolName} completed successfully`);
        return { content };
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Internal error';
        console.error(`[MCP] Tool ${toolName} error:`, errorMessage);
        if (error instanceof Error && error.stack) {
          console.error(`[MCP] Stack trace:`, error.stack);
        }
        throw error;
      }
    });

    // Resources list handler
    this.server.setRequestHandler(ListResourcesRequestSchema, async () => {
      const resources = this.getPromptResources();
      return { resources };
    });

    // Resources read handler
    this.server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
      const uri = request.params.uri;

      // URI format: bluekit://prompts/{filename}
      if (!uri.startsWith('bluekit://prompts/')) {
        throw new Error(`Invalid resource URI: ${uri}`);
      }

      const filename = uri.replace('bluekit://prompts/', '');
      const filePath = path.join(this.promptsDir, filename);

      // Security: ensure the file is within prompts directory
      const normalizedPath = path.normalize(filePath);
      if (!normalizedPath.startsWith(this.promptsDir)) {
        throw new Error(`Access denied: ${uri}`);
      }

      if (!fs.existsSync(filePath)) {
        throw new Error(`Resource not found: ${uri}`);
      }

      const content = fs.readFileSync(filePath, 'utf8');

      return {
        contents: [
          {
            uri,
            mimeType: 'text/markdown',
            text: content,
          },
        ],
      };
    });
  }

  private getPromptResources(): Array<{ uri: string; name: string; description: string; mimeType: string }> {
    const resources: Array<{ uri: string; name: string; description: string; mimeType: string }> = [];

    if (!fs.existsSync(this.promptsDir)) {
      return resources;
    }

    const files = fs.readdirSync(this.promptsDir);

    for (const file of files) {
      if (file.endsWith('.md')) {
        const uri = `bluekit://prompts/${file}`;
        const name = file.replace('.md', '').split('-').map(word =>
          word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');

        resources.push({
          uri,
          name,
          description: `BlueKit ${name} reference documentation`,
          mimeType: 'text/markdown',
        });
      }
    }

    return resources;
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('[MCP] BlueKit MCP server running on stdio');
  }
}

// ============================================================================
// MAIN
// ============================================================================

async function main(): Promise<void> {
  const server = new BluekitMCPServer();
  await server.run();
}

main().catch((error) => {
  console.error('[MCP] Fatal error:', error);
  process.exit(1);
});
