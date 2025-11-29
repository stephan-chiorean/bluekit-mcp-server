import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

interface BlueprintTask {
  id: string;
  kitFile: string;
  description: string;
}

interface BlueprintLayer {
  id: string;
  order: number;
  name: string;
  tasks: BlueprintTask[];
}

interface BlueprintMetadata {
  id: string;
  name: string;
  version: number;
  description: string;
  createdAt: string;
  layers: BlueprintLayer[];
}

interface BlueprintGenerateParams {
  projectPath: string;
  blueprint: BlueprintMetadata;
  kits: Record<string, string>; // kitFile -> content
}

export class BlueprintTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_blueprint_generateBlueprint',
        description: 'Generate a blueprint folder in .bluekit/blueprints/ containing blueprint.json and all generated kit files. Read the blueprint definition from MCP resources (bluekit://prompts/get-blueprint-definition.md) for context.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project where blueprint folder should be created'
            },
            blueprint: {
              type: 'object',
              description: 'Blueprint metadata with id, name, version, description, and layers'
            },
            kits: {
              type: 'object',
              description: 'Object mapping kit filenames to their markdown content. Example: {"database-setup.md": "# Database Setup\\n...", "api-server.md": "# API Server\\n..."}'
            }
          },
          required: ['projectPath', 'blueprint', 'kits']
        }
      },
      {
        name: 'bluekit_blueprint_listBlueprints',
        description: 'List all blueprints in the project\'s .bluekit/blueprints/ directory',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project'
            }
          },
          required: ['projectPath']
        }
      },
      {
        name: 'bluekit_blueprint_getBlueprint',
        description: 'Get a specific blueprint by ID including blueprint.json and all kit files',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project'
            },
            id: {
              type: 'string',
              description: 'ID of the blueprint to retrieve'
            }
          },
          required: ['projectPath', 'id']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_blueprint_generateBlueprint': (params) => this.handleGenerateBlueprint(params),
      'bluekit_blueprint_listBlueprints': (params) => this.handleListBlueprints(params),
      'bluekit_blueprint_getBlueprint': (params) => this.handleGetBlueprint(params)
    };
  }

  private handleGenerateBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const blueprint = params.blueprint as BlueprintMetadata;
    const kits = params.kits as Record<string, string>;

    // Validate inputs
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('blueprint is required and must be an object');
    }
    if (!kits || typeof kits !== 'object') {
      throw new Error('kits is required and must be an object');
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

    // Validate layers and collect all kitFiles
    const allKitFiles = new Set<string>();
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
        if (!task.kitFile || typeof task.kitFile !== 'string') {
          throw new Error('Each task must have a kitFile (string)');
        }
        if (!task.description || typeof task.description !== 'string') {
          throw new Error('Each task must have a description (string)');
        }
        allKitFiles.add(task.kitFile);
      }
    }

    // Validate all referenced kit files are provided
    for (const kitFile of allKitFiles) {
      if (!kits[kitFile]) {
        throw new Error(`Kit file "${kitFile}" is referenced in blueprint but not provided in kits object`);
      }
    }

    // Resolve absolute project path
    const resolvedProjectPath = path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(process.cwd(), projectPath);

    const bluekitDir = path.join(resolvedProjectPath, '.bluekit');
    const blueprintsDir = path.join(bluekitDir, 'blueprints');
    const blueprintFolder = path.join(blueprintsDir, blueprint.id);

    try {
      // Create directory structure
      if (!fs.existsSync(blueprintFolder)) {
        fs.mkdirSync(blueprintFolder, { recursive: true });
      }

      // Add createdAt timestamp if not provided
      if (!blueprint.createdAt) {
        blueprint.createdAt = new Date().toISOString();
      }

      // Write blueprint.json
      const blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
      fs.writeFileSync(blueprintJsonPath, JSON.stringify(blueprint, null, 2), 'utf8');

      // Write all kit files
      const kitFiles: string[] = [];
      for (const [kitFile, content] of Object.entries(kits)) {
        const kitPath = path.join(blueprintFolder, kitFile);
        fs.writeFileSync(kitPath, content, 'utf8');
        kitFiles.push(kitFile);
      }

      return [
        {
          type: 'text',
          text: `✅ Blueprint generated successfully!\n\n` +
                `Location: ${blueprintFolder}\n` +
                `Blueprint ID: ${blueprint.id}\n` +
                `Blueprint Name: ${blueprint.name}\n` +
                `Layers: ${blueprint.layers.length}\n` +
                `Kit files generated: ${kitFiles.length}\n` +
                `  - ${kitFiles.join('\n  - ')}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleListBlueprints(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;

    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    const resolvedProjectPath = path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(process.cwd(), projectPath);

    const blueprintsDir = path.join(resolvedProjectPath, '.bluekit', 'blueprints');

    try {
      if (!fs.existsSync(blueprintsDir)) {
        return [
          {
            type: 'text',
            text: 'No blueprints found. The .bluekit/blueprints directory does not exist yet.'
          }
        ];
      }

      const blueprintFolders = fs.readdirSync(blueprintsDir, { withFileTypes: true })
        .filter(dirent => dirent.isDirectory())
        .map(dirent => dirent.name);

      if (blueprintFolders.length === 0) {
        return [
          {
            type: 'text',
            text: 'No blueprints found in .bluekit/blueprints/'
          }
        ];
      }

      const blueprints: Array<{ id: string; name: string; version: number; description: string; layerCount: number }> = [];

      for (const folder of blueprintFolders) {
        const blueprintJsonPath = path.join(blueprintsDir, folder, 'blueprint.json');
        if (fs.existsSync(blueprintJsonPath)) {
          try {
            const content = fs.readFileSync(blueprintJsonPath, 'utf8');
            const metadata = JSON.parse(content) as BlueprintMetadata;
            blueprints.push({
              id: metadata.id,
              name: metadata.name,
              version: metadata.version,
              description: metadata.description,
              layerCount: metadata.layers.length
            });
          } catch (error) {
            // Skip invalid blueprint.json files
            continue;
          }
        }
      }

      if (blueprints.length === 0) {
        return [
          {
            type: 'text',
            text: 'No valid blueprints found (no blueprint.json files)'
          }
        ];
      }

      const blueprintList = blueprints.map(b =>
        `- ${b.name} (ID: ${b.id}, Version: ${b.version})\n  ${b.description}\n  Layers: ${b.layerCount}`
      ).join('\n\n');

      return [
        {
          type: 'text',
          text: `Found ${blueprints.length} blueprint(s) in ${blueprintsDir}:\n\n${blueprintList}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to list blueprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleGetBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const id = params.id as string;

    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    if (!id || typeof id !== 'string') {
      throw new Error('id is required and must be a string');
    }

    const resolvedProjectPath = path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(process.cwd(), projectPath);

    const blueprintFolder = path.join(resolvedProjectPath, '.bluekit', 'blueprints', id);
    const blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');

    try {
      if (!fs.existsSync(blueprintFolder)) {
        throw new Error(`Blueprint with ID "${id}" not found`);
      }

      if (!fs.existsSync(blueprintJsonPath)) {
        throw new Error(`Blueprint folder exists but blueprint.json not found`);
      }

      // Read blueprint.json
      const blueprintContent = fs.readFileSync(blueprintJsonPath, 'utf8');
      const metadata = JSON.parse(blueprintContent) as BlueprintMetadata;

      // Read all kit files
      const kitContents: Record<string, string> = {};
      const kitFiles = fs.readdirSync(blueprintFolder)
        .filter(file => file.endsWith('.md'));

      for (const kitFile of kitFiles) {
        const kitPath = path.join(blueprintFolder, kitFile);
        kitContents[kitFile] = fs.readFileSync(kitPath, 'utf8');
      }

      // Build detailed response
      let response = `Blueprint: ${metadata.name} (${metadata.id})\n`;
      response += `Version: ${metadata.version}\n`;
      response += `Description: ${metadata.description}\n`;
      response += `Created: ${metadata.createdAt}\n\n`;
      response += `Layers: ${metadata.layers.length}\n`;

      for (const layer of metadata.layers) {
        response += `\nLayer ${layer.order}: ${layer.name} (${layer.id})\n`;
        response += `  Tasks: ${layer.tasks.length}\n`;
        for (const task of layer.tasks) {
          response += `    - ${task.kitFile}: ${task.description}\n`;
        }
      }

      response += `\nKit Files: ${kitFiles.length}\n`;
      response += `  - ${kitFiles.join('\n  - ')}\n`;

      response += `\n---\nblueprint.json:\n${blueprintContent}\n`;

      return [
        {
          type: 'text',
          text: response
        }
      ];
    } catch (error) {
      throw new Error(`Failed to get blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
