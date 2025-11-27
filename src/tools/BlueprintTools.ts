import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import { loadPrompt } from '../promptLoader.js';
import { ToolDefinition, ToolHandler, Blueprint } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class BlueprintTools extends BaseToolSet {
  private readonly blueprintDefinition: string;
  private readonly blueprintRegistryPath: string;

  constructor() {
    super();
    this.blueprintDefinition = loadPrompt('get-blueprint-definition.md');
    const homeDir = os.homedir();
    const bluekitStoreDir = path.join(homeDir, '.bluekit');
    this.blueprintRegistryPath = path.join(bluekitStoreDir, 'blueprintRegistry.json');
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit.blueprint.getBlueprintDefinition',
        description: 'Get the full Blueprint Definition text',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.blueprint.generateBlueprint',
        description: 'Generate a blueprint JSON file in the global ~/.bluekit/blueprintRegistry.json. Use bluekit.blueprint.getBlueprintDefinition to get the blueprint definition for context, then generate the blueprint JSON object and use this tool to save it.',
        inputSchema: {
          type: 'object',
          properties: {
            blueprint: {
              type: 'object',
              description: 'Blueprint JSON object with id, name, version, description, and layers (each layer has id, order, name, and tasks array)'
            }
          },
          required: ['blueprint']
        }
      },
      {
        name: 'bluekit.blueprint.listBlueprints',
        description: 'List all blueprints in the global blueprint registry',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.blueprint.getBlueprint',
        description: 'Get a specific blueprint by ID from the global blueprint registry',
        inputSchema: {
          type: 'object',
          properties: {
            id: {
              type: 'string',
              description: 'ID of the blueprint to retrieve'
            }
          },
          required: ['id']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit.blueprint.getBlueprintDefinition': () => this.handleGetBlueprintDefinition(),
      'bluekit.blueprint.generateBlueprint': (params) => this.handleGenerateBlueprint(params),
      'bluekit.blueprint.listBlueprints': () => this.handleListBlueprints(),
      'bluekit.blueprint.getBlueprint': (params) => this.handleGetBlueprint(params)
    };
  }

  private handleGetBlueprintDefinition(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: this.blueprintDefinition }
    ];
  }

  private handleGenerateBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const blueprint = params.blueprint as Blueprint;
    
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('blueprint is required and must be an object');
    }

    // Validate blueprint structure
    if (!blueprint.id || typeof blueprint.id !== 'string') {
      throw new Error('blueprint.id is required and must be a string');
    }
    if (!blueprint.name || typeof blueprint.name !== 'string') {
      throw new Error('blueprint.name is required and must be a string');
    }
    if (typeof blueprint.version !== 'number') {
      throw new Error('blueprint.version is required and must be a number');
    }
    if (!blueprint.description || typeof blueprint.description !== 'string') {
      throw new Error('blueprint.description is required and must be a string');
    }
    if (!Array.isArray(blueprint.layers)) {
      throw new Error('blueprint.layers is required and must be an array');
    }

    // Validate layers
    for (const layer of blueprint.layers) {
      if (!layer.id || typeof layer.id !== 'string') {
        throw new Error('Each layer must have an id (string)');
      }
      if (typeof layer.order !== 'number') {
        throw new Error('Each layer must have an order (number)');
      }
      if (!layer.name || typeof layer.name !== 'string') {
        throw new Error('Each layer must have a name (string)');
      }
      if (!Array.isArray(layer.tasks)) {
        throw new Error('Each layer must have a tasks array');
      }

      // Validate tasks
      for (const task of layer.tasks) {
        if (!task.id || typeof task.id !== 'string') {
          throw new Error('Each task must have an id (string)');
        }
        if (!task.alias || typeof task.alias !== 'string') {
          throw new Error('Each task must have an alias (string)');
        }
        if (!task.agent || typeof task.agent !== 'string') {
          throw new Error('Each task must have an agent (string)');
        }
        if (!task.kit || typeof task.kit !== 'string') {
          throw new Error('Each task must have a kit (string)');
        }
      }
    }

    const homeDir = os.homedir();
    const bluekitStoreDir = path.join(homeDir, '.bluekit');

    try {
      // Ensure ~/.bluekit directory exists
      if (!fs.existsSync(bluekitStoreDir)) {
        fs.mkdirSync(bluekitStoreDir, { recursive: true });
      }

      // Read existing registry or create new one
      let registry: Blueprint[] = [];
      if (fs.existsSync(this.blueprintRegistryPath)) {
        try {
          const registryContent = fs.readFileSync(this.blueprintRegistryPath, 'utf8');
          registry = JSON.parse(registryContent);
          
          if (!Array.isArray(registry)) {
            registry = [];
          }
        } catch (error) {
          registry = [];
        }
      }

      // Check if blueprint with same ID exists
      const existingIndex = registry.findIndex(b => b.id === blueprint.id);
      
      if (existingIndex >= 0) {
        // Update existing blueprint
        registry[existingIndex] = blueprint;
      } else {
        // Add new blueprint
        registry.push(blueprint);
      }

      // Write registry back to file
      fs.writeFileSync(this.blueprintRegistryPath, JSON.stringify(registry, null, 2), 'utf8');

      const action = existingIndex >= 0 ? 'updated' : 'added';
      return [
        {
          type: 'text',
          text: `✅ Blueprint ${action} to registry!\n\n` +
                `Registry location: ${this.blueprintRegistryPath}\n` +
                `Blueprint ID: ${blueprint.id}\n` +
                `Blueprint Name: ${blueprint.name}\n` +
                `Total blueprints in registry: ${registry.length}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleListBlueprints(): Array<{ type: 'text'; text: string }> {
    try {
      if (!fs.existsSync(this.blueprintRegistryPath)) {
        return [
          {
            type: 'text',
            text: 'No blueprints found. Registry does not exist yet.'
          }
        ];
      }

      const registryContent = fs.readFileSync(this.blueprintRegistryPath, 'utf8');
      const registry: Blueprint[] = JSON.parse(registryContent);
      
      if (!Array.isArray(registry) || registry.length === 0) {
        return [
          {
            type: 'text',
            text: 'No blueprints found in registry.'
          }
        ];
      }

      const blueprintList = registry.map(b => 
        `- ${b.name} (ID: ${b.id}, Version: ${b.version})\n  ${b.description}`
      ).join('\n\n');

      return [
        {
          type: 'text',
          text: `Found ${registry.length} blueprint(s):\n\n${blueprintList}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to list blueprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleGetBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const id = params.id as string;
    
    if (!id || typeof id !== 'string') {
      throw new Error('id is required and must be a string');
    }

    try {
      if (!fs.existsSync(this.blueprintRegistryPath)) {
        throw new Error(`Blueprint with ID "${id}" not found. Registry does not exist.`);
      }

      const registryContent = fs.readFileSync(this.blueprintRegistryPath, 'utf8');
      const registry: Blueprint[] = JSON.parse(registryContent);
      
      if (!Array.isArray(registry)) {
        throw new Error(`Blueprint with ID "${id}" not found.`);
      }

      const blueprint = registry.find(b => b.id === id);
      
      if (!blueprint) {
        throw new Error(`Blueprint with ID "${id}" not found.`);
      }

      return [
        {
          type: 'text',
          text: JSON.stringify(blueprint, null, 2)
        }
      ];
    } catch (error) {
      throw new Error(`Failed to get blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
