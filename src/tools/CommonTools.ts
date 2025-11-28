import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

/**
 * Common tools shared across all tool sets (ping, batchExecute, init_project)
 */
export class CommonTools extends BaseToolSet {
  private allToolSets: BaseToolSet[] = [];

  setToolSets(toolSets: BaseToolSet[]): void {
    this.allToolSets = toolSets;
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_ping',
        description: 'Health check for BlueKit MCP server',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit_batchExecute',
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
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_ping': () => this.handlePing(),
      'bluekit_batchExecute': (params) => this.handleBatchExecute(params),
      'bluekit_init_project': (params) => this.handleInitProject(params)
    };
  }

  private handlePing(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: 'pong from BlueKit!' }
    ];
  }

  private handleBatchExecute(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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

      // Try to find handler in any of the tool sets
      let handler: ToolHandler | undefined;
      for (const toolSet of this.allToolSets) {
        handler = toolSet.getToolHandler(task.name);
        if (handler) break;
      }

      // Also check common tools
      if (!handler) {
        handler = this.getToolHandler(task.name);
      }

      if (!handler) {
        results.push({
          task: task.name,
          success: false,
          error: `Tool not found: ${task.name}`
        });
        continue;
      }

      try {
        const result = handler(task.params);
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
  }

  private handleInitProject(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const confirm = params.confirm as boolean | undefined;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    const homeDir = os.homedir();
    const bluekitStoreDir = path.join(homeDir, '.bluekit');
    const registryPath = path.join(bluekitStoreDir, 'projectRegistry.json');

    // Check if ~/.bluekit directory exists
    if (!fs.existsSync(bluekitStoreDir)) {
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
        
        if (!Array.isArray(registry)) {
          registry = [];
        }
      } catch (error) {
        registry = [];
      }
    }

    // Check if project is already in registry
    const normalizedProjectPath = path.resolve(projectPath);
    const existingIndex = registry.findIndex(p => path.resolve(p.path) === normalizedProjectPath);

    if (existingIndex >= 0) {
      const projectName = path.basename(projectPath);
      registry[existingIndex] = {
        id: registry[existingIndex].id,
        title: registry[existingIndex].title || projectName,
        description: registry[existingIndex].description,
        path: normalizedProjectPath
      };
    } else {
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
}

