import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import Ajv from 'ajv';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';
import { SourceResolver } from './SourceResolver.js';
import { TemplateEngine } from './TemplateEngine.js';
import { FileOperationsExecutor } from './FileOperations.js';

interface FileOperation {
  type: 'copy' | 'template' | 'generate';
  source?: string;      // Template or source path
  destination: string;  // Output path
  variables?: string[]; // Variables for templating
}

interface BlueprintTask {
  id: string;
  taskFile: string;
  description: string;
  operations?: FileOperation[]; // NEW: File operations
}

interface BlueprintLayer {
  id: string;
  order: number;
  name: string;
  classification?: 'foundation' | 'domain' | 'integration' | 'configuration';
  tasks: BlueprintTask[];
}

interface SourceReference {
  type: 'local' | 'global' | 'git';
  path?: string;          // Local path or global registry ID
  gitUrl?: string;        // Git repository
  gitRef?: string;        // Branch/tag/commit
  preservePaths?: string[]; // Files/dirs to copy verbatim
}

interface BlueprintMetadata {
  id: string;
  name: string;
  version: number;
  description: string;
  createdAt: string;
  layers: BlueprintLayer[];

  // NEW: Composition
  extends?: string;  // Parent blueprint ID

  // NEW: Source references (for copying files)
  sourceReference?: SourceReference;

  // NEW: Configuration schema
  configSchema?: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

interface BlueprintGenerateParams {
  projectPath: string;
  blueprint: BlueprintMetadata;
  tasks: Record<string, string>; // taskFile -> content
}

export class BlueprintTools extends BaseToolSet {
  private sourceResolver: SourceResolver;
  private templateEngine: TemplateEngine;
  private fileOpsExecutor: FileOperationsExecutor;

  constructor() {
    super();
    this.sourceResolver = new SourceResolver();
    this.templateEngine = new TemplateEngine();
    this.fileOpsExecutor = new FileOperationsExecutor(this.sourceResolver, this.templateEngine);
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_blueprint_planBlueprint',
        description: 'Plan a blueprint structure by analyzing requirements and ensuring proper layer parallelization. This tool validates layer dependencies and provides warnings/suggestions before generation. Use this BEFORE bluekit_blueprint_generateBlueprint to ensure correct structure.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'Description of what blueprint to create (e.g., "React + Tauri desktop app with file watching")'
            },
            blueprint: {
              type: 'object',
              description: 'Proposed blueprint structure with layers and tasks'
            }
          },
          required: ['description', 'blueprint']
        }
      },
      {
        name: 'bluekit_blueprint_generateBlueprint',
        description: 'Generate a blueprint folder in .bluekit/blueprints/ containing blueprint.json and all task files. Tasks are blueprint-specific instructions (not reusable kits). Optionally save to global registry at ~/.bluekit/blueprintRegistry.json. IMPORTANT: Use bluekit_blueprint_planBlueprint first to validate structure. Read the blueprint definition from MCP resources (bluekit://prompts/get-blueprint-definition.md) for context.',
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
      },
      {
        name: 'bluekit_blueprint_validateConfig',
        description: 'Validate an application configuration against a blueprint\'s config schema. Returns validation errors if the config doesn\'t match the schema.',
        inputSchema: {
          type: 'object',
          properties: {
            blueprintId: {
              type: 'string',
              description: 'ID of the blueprint to validate against'
            },
            config: {
              type: 'object',
              description: 'Application configuration to validate'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project (optional - searches global registry if not provided)'
            }
          },
          required: ['blueprintId', 'config']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_blueprint_planBlueprint': (params) => this.handlePlanBlueprint(params),
      'bluekit_blueprint_generateBlueprint': (params) => this.handleGenerateBlueprint(params),
      'bluekit_blueprint_listBlueprints': (params) => this.handleListBlueprints(params),
      'bluekit_blueprint_getBlueprint': (params) => this.handleGetBlueprint(params),
      'bluekit_blueprint_validateConfig': (params) => this.handleValidateConfig(params)
    };
  }

  private handlePlanBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const blueprint = params.blueprint as BlueprintMetadata;

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }
    if (!blueprint || typeof blueprint !== 'object') {
      throw new Error('blueprint is required and must be an object');
    }

    // Validate blueprint structure
    if (!Array.isArray(blueprint.layers) || blueprint.layers.length === 0) {
      throw new Error('blueprint.layers is required and must be a non-empty array');
    }

    // Analyze layers for parallelization issues
    const analysis = this.analyzeBlueprintLayers(blueprint);

    let response = `Blueprint Plan Analysis\n`;
    response += `========================\n\n`;
    response += `Description: ${description}\n`;
    response += `Layers: ${blueprint.layers.length}\n`;
    response += `Total Tasks: ${blueprint.layers.reduce((sum, layer) => sum + (layer.tasks?.length || 0), 0)}\n\n`;

    if (analysis.errors.length > 0) {
      response += `❌ ERRORS (Must Fix):\n`;
      response += `${'='.repeat(50)}\n`;
      for (const error of analysis.errors) {
        response += `\n${error}\n`;
      }
      response += `\n`;
    }

    if (analysis.warnings.length > 0) {
      response += `⚠️  WARNINGS (Review Recommended):\n`;
      response += `${'='.repeat(50)}\n`;
      for (const warning of analysis.warnings) {
        response += `\n${warning}\n`;
      }
      response += `\n`;
    }

    if (analysis.suggestions.length > 0) {
      response += `💡 SUGGESTIONS (Optimization):\n`;
      response += `${'='.repeat(50)}\n`;
      for (const suggestion of analysis.suggestions) {
        response += `\n${suggestion}\n`;
      }
      response += `\n`;
    }

    if (analysis.errors.length === 0 && analysis.warnings.length === 0) {
      response += `✅ Blueprint structure looks good!\n`;
      response += `All layers pass parallelization validation.\n`;
      response += `Ready to proceed with bluekit_blueprint_generateBlueprint.\n`;
    } else if (analysis.errors.length === 0) {
      response += `⚠️  Blueprint has warnings but no errors.\n`;
      response += `You can proceed with generation, but consider reviewing warnings.\n`;
    } else {
      response += `❌ Blueprint has errors that must be fixed before generation.\n`;
      response += `Please restructure layers to eliminate dependencies within each layer.\n`;
    }

    return [{ type: 'text', text: response }];
  }

  private analyzeBlueprintLayers(blueprint: BlueprintMetadata): {
    errors: string[];
    warnings: string[];
    suggestions: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];
    const suggestions: string[] = [];

    // Common dependency keywords that suggest sequential execution
    const dependencyKeywords = [
      { pattern: /create.*project|init.*project|setup.*project/i, dependsOn: null, provides: 'project-structure' },
      { pattern: /config|configure/i, dependsOn: 'project-structure', provides: 'configuration' },
      { pattern: /install.*dep|dep.*install|npm install|yarn install/i, dependsOn: 'project-structure', provides: 'dependencies' },
      { pattern: /module|struct/i, dependsOn: null, provides: 'modules' },
      { pattern: /main\.rs|main\.ts|index\.|entry/i, dependsOn: 'modules', provides: 'entry-point' },
      { pattern: /rust.*command|backend.*command|ipc.*handler/i, dependsOn: 'modules', provides: 'backend-api' },
      { pattern: /typescript.*wrapper|frontend.*wrapper|client.*wrapper/i, dependsOn: 'backend-api', provides: 'frontend-client' },
      { pattern: /integration|connect|wire/i, dependsOn: 'frontend-client', provides: 'integration' }
    ];

    for (const layer of blueprint.layers) {
      if (!Array.isArray(layer.tasks)) {
        errors.push(`Layer ${layer.order} (${layer.name}): tasks must be an array`);
        continue;
      }

      if (layer.tasks.length === 0) {
        warnings.push(`Layer ${layer.order} (${layer.name}): empty layer - consider removing`);
        continue;
      }

      // Analyze tasks within the layer for potential dependencies
      const layerProvides = new Set<string>();
      const layerRequires = new Set<string>();

      for (const task of layer.tasks) {
        const taskDesc = `${task.taskFile} - ${task.description}`.toLowerCase();

        for (const keyword of dependencyKeywords) {
          if (keyword.pattern.test(taskDesc)) {
            if (keyword.provides) layerProvides.add(keyword.provides);
            if (keyword.dependsOn) layerRequires.add(keyword.dependsOn);
          }
        }
      }

      // Check if layer both requires and provides - sign of internal dependency
      // Only flag as error if there are multiple tasks (single task can't have internal dependencies)
      const intersection = Array.from(layerProvides).filter(x => layerRequires.has(x));
      if (intersection.length > 0 && layer.tasks.length > 1) {
        errors.push(
          `Layer ${layer.order} (${layer.name}): Contains tasks with dependencies on each other.\n` +
          `  Detected dependency chain: ${intersection.join(', ')}\n` +
          `  Tasks in this layer:\n` +
          layer.tasks.map(t => `    - ${t.taskFile}: ${t.description}`).join('\n') +
          `\n  FIX: Split into separate layers OR consolidate into a single comprehensive task.`
        );
      }

      // Check for specific anti-patterns
      if (layer.tasks.length > 1) {
        const taskDescriptions = layer.tasks.map(t => t.description.toLowerCase());

        // Pattern: "create X" + "configure X" in same layer
        const hasCreate = taskDescriptions.some(d => /create|init|setup/.test(d));
        const hasConfigure = taskDescriptions.some(d => /config|configure|settings/.test(d));
        if (hasCreate && hasConfigure) {
          errors.push(
            `Layer ${layer.order} (${layer.name}): Contains both creation AND configuration tasks.\n` +
            `  This violates parallelization - configuration depends on creation.\n` +
            `  FIX: Either split into 2 layers OR combine into 1 comprehensive "setup" task.`
          );
        }

        // Pattern: "modules" + "main entry" in same layer
        const hasModules = taskDescriptions.some(d => /module|struct/i.test(d));
        const hasMain = taskDescriptions.some(d => /main\.|entry|index\./i.test(d));
        if (hasModules && hasMain) {
          errors.push(
            `Layer ${layer.order} (${layer.name}): Contains both module creation AND main entry.\n` +
            `  Main entry imports modules - they cannot be in the same layer.\n` +
            `  FIX: Split into 2 layers OR combine into 1 comprehensive "backend foundation" task.`
          );
        }

        // Pattern: "backend API" + "frontend wrapper" in same layer
        const hasBackendAPI = taskDescriptions.some(d => /rust.*command|backend|ipc.*handler/i.test(d));
        const hasFrontendWrapper = taskDescriptions.some(d => /typescript.*wrapper|frontend.*wrapper|client/i.test(d));
        if (hasBackendAPI && hasFrontendWrapper) {
          errors.push(
            `Layer ${layer.order} (${layer.name}): Contains both backend API AND frontend wrappers.\n` +
            `  Frontend wrappers depend on backend API signatures.\n` +
            `  FIX: Split into 2 layers OR combine into 1 comprehensive "IPC system" task.`
          );
        }
      }

      // Suggestions for optimization
      if (layer.tasks.length === 1 && blueprint.layers.length > 1) {
        const nextLayer = blueprint.layers.find(l => l.order === layer.order + 1);
        if (nextLayer && nextLayer.tasks.length === 1) {
          suggestions.push(
            `Layers ${layer.order} and ${layer.order + 1}: Both have single tasks.\n` +
            `  Consider: Could these be combined into one comprehensive task?`
          );
        }
      }

      if (layer.tasks.length > 5) {
        warnings.push(
          `Layer ${layer.order} (${layer.name}): Contains ${layer.tasks.length} tasks.\n` +
          `  Recommendation: If these tasks are truly independent, this is fine.\n` +
          `  However, consider if some could be consolidated for easier execution.`
        );
      }
    }

    return { errors, warnings, suggestions };
  }

  private async handleGenerateBlueprint(params: Record<string, unknown>): Promise<Array<{ type: 'text'; text: string }>> {
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

    // COMPOSITION: Load parent blueprint if extending
    if (blueprint.extends) {
      const parent = this.loadBlueprint(blueprint.extends, projectPath);

      // Merge parent layers with child layers
      // Parent layers come first, child layers are appended
      blueprint.layers = [...parent.layers, ...blueprint.layers];

      // Inherit source reference if not specified
      if (!blueprint.sourceReference && parent.sourceReference) {
        blueprint.sourceReference = parent.sourceReference;
      }

      console.log(`[BlueprintTools] Extended blueprint "${blueprint.extends}" with ${parent.layers.length} parent layers`);
    }

    // Run layer parallelization analysis
    const analysis = this.analyzeBlueprintLayers(blueprint);
    if (analysis.errors.length > 0) {
      let errorMsg = '❌ Blueprint has layer parallelization errors:\n\n';
      for (const error of analysis.errors) {
        errorMsg += `${error}\n\n`;
      }
      errorMsg += 'Please fix these errors before generating. Use bluekit_blueprint_planBlueprint to validate.';
      throw new Error(errorMsg);
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
      const blueprintJson = this.ensureFinalNewline(JSON.stringify(blueprint, null, 2));
      fs.writeFileSync(blueprintJsonPath, blueprintJson, 'utf8');

      // Write all task files with YAML front matter
      const taskFiles: string[] = [];
      for (const [taskFile, content] of Object.entries(tasks)) {
        const taskPath = path.join(blueprintFolder, taskFile);
        const contentWithFrontMatter = this.ensureFinalNewline(this.addTaskFrontMatter(content, taskFile));
        fs.writeFileSync(taskPath, contentWithFrontMatter, 'utf8');
        taskFiles.push(taskFile);
      }

      // SOURCE REFERENCE: Resolve and copy preserved paths
      let sourcePath: string | undefined;
      if (blueprint.sourceReference) {
        sourcePath = await this.sourceResolver.resolve(blueprint.sourceReference, resolvedProjectPath);
        console.log(`[BlueprintTools] Resolved source reference to: ${sourcePath}`);

        if (blueprint.sourceReference.preservePaths && blueprint.sourceReference.preservePaths.length > 0) {
          await this.sourceResolver.copyPreservedPaths(
            sourcePath,
            blueprintFolder,
            blueprint.sourceReference.preservePaths
          );
          console.log(`[BlueprintTools] Copied ${blueprint.sourceReference.preservePaths.length} preserved paths`);
        }
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
   * Validate an application configuration against a blueprint's config schema
   */
  private handleValidateConfig(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const blueprintId = params.blueprintId as string;
    const config = params.config as Record<string, any>;
    const projectPath = params.projectPath as string | undefined;

    if (!blueprintId || typeof blueprintId !== 'string') {
      throw new Error('blueprintId is required and must be a string');
    }
    if (!config || typeof config !== 'object') {
      throw new Error('config is required and must be an object');
    }

    try {
      // Load the blueprint
      const blueprint = this.loadBlueprint(blueprintId, projectPath);

      // Check if blueprint has a config schema
      if (!blueprint.configSchema) {
        return [
          {
            type: 'text',
            text: `Blueprint "${blueprintId}" does not have a configuration schema.\nNo validation required.`
          }
        ];
      }

      // Validate using Ajv
      const ajv = new Ajv({ allErrors: true });
      const validate = ajv.compile(blueprint.configSchema);
      const valid = validate(config);

      if (valid) {
        return [
          {
            type: 'text',
            text: `✅ Configuration is valid!\n\nBlueprint: ${blueprint.name}\nNo validation errors found.`
          }
        ];
      } else {
        // Format validation errors
        let errorMsg = `❌ Configuration validation failed!\n\n`;
        errorMsg += `Blueprint: ${blueprint.name}\n\n`;
        errorMsg += `Errors:\n`;

        if (validate.errors) {
          for (const error of validate.errors) {
            const dataPath = error.instancePath || '(root)';
            const message = error.message || 'Unknown error';
            errorMsg += `  - ${dataPath}: ${message}\n`;
            if (error.params && Object.keys(error.params).length > 0) {
              errorMsg += `    Params: ${JSON.stringify(error.params)}\n`;
            }
          }
        }

        return [
          {
            type: 'text',
            text: errorMsg
          }
        ];
      }
    } catch (error) {
      throw new Error(`Failed to validate config: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Load a blueprint by ID from project or global registry
   */
  private loadBlueprint(blueprintId: string, projectPath?: string): BlueprintMetadata {
    let blueprintFolder: string;
    let blueprintJsonPath: string;

    // First try global registry
    const registry = this.readGlobalRegistry();
    const entry = registry[blueprintId];

    if (entry) {
      blueprintFolder = path.join(entry.projectPath, '.bluekit', 'blueprints', blueprintId);
      blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
    } else if (projectPath) {
      // Try project folder
      const resolvedProjectPath = path.isAbsolute(projectPath)
        ? path.normalize(projectPath)
        : path.resolve(process.cwd(), projectPath);
      blueprintFolder = path.join(resolvedProjectPath, '.bluekit', 'blueprints', blueprintId);
      blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
    } else {
      throw new Error(`Blueprint with ID "${blueprintId}" not found`);
    }

    if (!fs.existsSync(blueprintJsonPath)) {
      throw new Error(`Blueprint with ID "${blueprintId}" not found`);
    }

    const content = fs.readFileSync(blueprintJsonPath, 'utf8');
    return JSON.parse(content) as BlueprintMetadata;
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

    const registryJson = this.ensureFinalNewline(JSON.stringify(registry, null, 2));
    fs.writeFileSync(registryPath, registryJson, 'utf8');
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
