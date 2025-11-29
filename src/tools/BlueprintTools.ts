import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

interface BlueprintTask {
  id: string;
  taskFile: string;
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
  tasks: Record<string, string>; // taskFile -> content
}

export class BlueprintTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_blueprint_generateBlueprint',
        description: 'Generate a blueprint folder in .bluekit/blueprints/ containing blueprint.json and all task files. Tasks are blueprint-specific instructions (not reusable kits). Optionally save to global registry at ~/.bluekit/blueprintRegistry.json. Read the blueprint definition from MCP resources (bluekit://prompts/get-blueprint-definition.md) for context.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project where blueprint folder should be created'
            },
            blueprint: {
              type: 'object',
              description: 'Blueprint metadata with id, name, version, description, and layers. Each task in layers should have taskFile property.'
            },
            tasks: {
              type: 'object',
              description: 'Object mapping task filenames to their markdown content. Example: {"database-setup.md": "# Database Setup\\n...", "api-server.md": "# API Server\\n..."}'
            },
            saveToGlobal: {
              type: 'boolean',
              description: 'If true, also save blueprint reference to global registry at ~/.bluekit/blueprintRegistry.json. Default: false'
            }
          },
          required: ['projectPath', 'blueprint', 'tasks']
        }
      },
      {
        name: 'bluekit_blueprint_listBlueprints',
        description: 'List blueprints from project\'s .bluekit/blueprints/ directory and/or global registry at ~/.bluekit/blueprintRegistry.json',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project (optional - if not provided, only lists global blueprints)'
            },
            includeGlobal: {
              type: 'boolean',
              description: 'If true, also include blueprints from global registry. Default: false'
            }
          },
          required: []
        }
      },
      {
        name: 'bluekit_blueprint_getBlueprint',
        description: 'Get a specific blueprint by ID including blueprint.json and all task files. Can retrieve from project folder or global registry.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project (optional - if not provided, searches global registry)'
            },
            id: {
              type: 'string',
              description: 'ID of the blueprint to retrieve'
            },
            fromGlobal: {
              type: 'boolean',
              description: 'If true, retrieve from global registry instead of project folder. Default: false'
            }
          },
          required: ['id']
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
    const tasks = params.tasks as Record<string, string>;
    const saveToGlobal = (params.saveToGlobal as boolean) || false;

    // Validate inputs
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('blueprint is required and must be an object');
    }
    if (!tasks || typeof tasks !== 'object') {
      throw new Error('tasks is required and must be an object');
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

    // Validate layers and collect all taskFiles
    const allTaskFiles = new Set<string>();
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
        if (!task.taskFile || typeof task.taskFile !== 'string') {
          throw new Error('Each task must have a taskFile (string)');
        }
        if (!task.description || typeof task.description !== 'string') {
          throw new Error('Each task must have a description (string)');
        }
        allTaskFiles.add(task.taskFile);
      }
    }

    // Validate all referenced task files are provided
    for (const taskFile of allTaskFiles) {
      if (!tasks[taskFile]) {
        throw new Error(`Task file "${taskFile}" is referenced in blueprint but not provided in tasks object`);
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

      // Write all task files with YAML front matter
      const taskFiles: string[] = [];
      for (const [taskFile, content] of Object.entries(tasks)) {
        const taskPath = path.join(blueprintFolder, taskFile);
        const contentWithFrontMatter = this.addTaskFrontMatter(content, taskFile);
        fs.writeFileSync(taskPath, contentWithFrontMatter, 'utf8');
        taskFiles.push(taskFile);
      }

      // Save to global registry if requested
      if (saveToGlobal) {
        const registry = this.readGlobalRegistry();
        registry[blueprint.id] = {
          projectPath: resolvedProjectPath,
          createdAt: blueprint.createdAt
        };
        this.writeGlobalRegistry(registry);
      }

      const globalMessage = saveToGlobal ? `\n✅ Saved to global registry` : '';

      return [
        {
          type: 'text',
          text: `✅ Blueprint generated successfully!\n\n` +
                `Location: ${blueprintFolder}\n` +
                `Blueprint ID: ${blueprint.id}\n` +
                `Blueprint Name: ${blueprint.name}\n` +
                `Layers: ${blueprint.layers.length}\n` +
                `Task files generated: ${taskFiles.length}\n` +
                `  - ${taskFiles.join('\n  - ')}` +
                globalMessage
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleListBlueprints(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string | undefined;
    const includeGlobal = (params.includeGlobal as boolean) || false;

    try {
      const blueprints: Array<{ id: string; name: string; version: number; description: string; layerCount: number; source: string }> = [];

      // List local project blueprints if projectPath is provided
      if (projectPath && typeof projectPath === 'string') {
        const resolvedProjectPath = path.isAbsolute(projectPath)
          ? path.normalize(projectPath)
          : path.resolve(process.cwd(), projectPath);

        const blueprintsDir = path.join(resolvedProjectPath, '.bluekit', 'blueprints');

        if (fs.existsSync(blueprintsDir)) {
          const blueprintFolders = fs.readdirSync(blueprintsDir, { withFileTypes: true })
            .filter(dirent => dirent.isDirectory())
            .map(dirent => dirent.name);

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
                  layerCount: metadata.layers.length,
                  source: 'local'
                });
              } catch (error) {
                // Skip invalid blueprint.json files
                continue;
              }
            }
          }
        }
      }

      // List global blueprints if requested
      if (includeGlobal || !projectPath) {
        const registry = this.readGlobalRegistry();
        for (const [id, entry] of Object.entries(registry)) {
          const blueprintFolder = path.join(entry.projectPath, '.bluekit', 'blueprints', id);
          const blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');

          if (fs.existsSync(blueprintJsonPath)) {
            try {
              const content = fs.readFileSync(blueprintJsonPath, 'utf8');
              const metadata = JSON.parse(content) as BlueprintMetadata;
              blueprints.push({
                id: metadata.id,
                name: metadata.name,
                version: metadata.version,
                description: metadata.description,
                layerCount: metadata.layers.length,
                source: 'global'
              });
            } catch (error) {
              // Skip invalid blueprints
              continue;
            }
          }
        }
      }

      if (blueprints.length === 0) {
        return [
          {
            type: 'text',
            text: 'No blueprints found.'
          }
        ];
      }

      const localBlueprints = blueprints.filter(b => b.source === 'local');
      const globalBlueprints = blueprints.filter(b => b.source === 'global');

      let response = '';

      if (localBlueprints.length > 0) {
        const localList = localBlueprints.map(b =>
          `- ${b.name} (ID: ${b.id}, Version: ${b.version})\n  ${b.description}\n  Layers: ${b.layerCount}`
        ).join('\n\n');
        response += `Local Blueprints (${localBlueprints.length}):\n\n${localList}`;
      }

      if (globalBlueprints.length > 0) {
        const globalList = globalBlueprints.map(b =>
          `- ${b.name} (ID: ${b.id}, Version: ${b.version})\n  ${b.description}\n  Layers: ${b.layerCount}`
        ).join('\n\n');
        if (response) response += '\n\n';
        response += `Global Blueprints (${globalBlueprints.length}):\n\n${globalList}`;
      }

      return [
        {
          type: 'text',
          text: response
        }
      ];
    } catch (error) {
      throw new Error(`Failed to list blueprints: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private handleGetBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string | undefined;
    const id = params.id as string;
    const fromGlobal = (params.fromGlobal as boolean) || false;

    if (!id || typeof id !== 'string') {
      throw new Error('id is required and must be a string');
    }

    let blueprintFolder: string;
    let blueprintJsonPath: string;

    // Determine where to look for the blueprint
    if (fromGlobal || !projectPath) {
      // Look in global registry
      const registry = this.readGlobalRegistry();
      const entry = registry[id];

      if (!entry) {
        throw new Error(`Blueprint with ID "${id}" not found in global registry`);
      }

      blueprintFolder = path.join(entry.projectPath, '.bluekit', 'blueprints', id);
      blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
    } else {
      // Look in project folder
      if (!projectPath || typeof projectPath !== 'string') {
        throw new Error('projectPath is required when not using global registry');
      }

      const resolvedProjectPath = path.isAbsolute(projectPath)
        ? path.normalize(projectPath)
        : path.resolve(process.cwd(), projectPath);

      blueprintFolder = path.join(resolvedProjectPath, '.bluekit', 'blueprints', id);
      blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
    }

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

      // Read all task files
      const taskContents: Record<string, string> = {};
      const taskFiles = fs.readdirSync(blueprintFolder)
        .filter(file => file.endsWith('.md'));

      for (const taskFile of taskFiles) {
        const taskPath = path.join(blueprintFolder, taskFile);
        taskContents[taskFile] = fs.readFileSync(taskPath, 'utf8');
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
          response += `    - ${task.taskFile}: ${task.description}\n`;
        }
      }

      response += `\nTask Files: ${taskFiles.length}\n`;
      response += `  - ${taskFiles.join('\n  - ')}\n`;

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

  /**
   * Get the global blueprint registry path
   */
  private getGlobalRegistryPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return path.join(homeDir, '.bluekit', 'blueprintRegistry.json');
  }

  /**
   * Read the global blueprint registry
   */
  private readGlobalRegistry(): Record<string, { projectPath: string; createdAt: string }> {
    const registryPath = this.getGlobalRegistryPath();

    if (!fs.existsSync(registryPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(registryPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[BlueprintTools] Failed to read global registry:', error);
      return {};
    }
  }

  /**
   * Write to the global blueprint registry
   */
  private writeGlobalRegistry(registry: Record<string, { projectPath: string; createdAt: string }>): void {
    const registryPath = this.getGlobalRegistryPath();
    const registryDir = path.dirname(registryPath);

    if (!fs.existsSync(registryDir)) {
      fs.mkdirSync(registryDir, { recursive: true });
    }

    fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2), 'utf8');
  }

  /**
   * Add YAML front matter to task content
   */
  private addTaskFrontMatter(content: string, taskFile: string): string {
    // Check if content already has front matter
    if (content.trim().startsWith('---')) {
      return content; // Already has front matter
    }

    // Generate task ID from filename
    const taskId = taskFile.replace('.md', '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const frontMatter = {
      id: taskId,
      type: 'task',
      version: 1
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n${content}`;
  }
}
