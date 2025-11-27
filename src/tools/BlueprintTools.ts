import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { loadPrompt } from '../promptLoader.js';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class BlueprintTools extends BaseToolSet {
  private readonly blueprintDefinition: string;

  constructor() {
    super();
    this.blueprintDefinition = loadPrompt('get-blueprint-definition.md');
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
        description: 'Generate a blueprint file in the .bluekit directory of the specified project path with the generated content. Use bluekit.blueprint.getBlueprintDefinition to get the blueprint definition for context, then generate the blueprint content and use this tool to save it.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string',
              description: 'Name of the blueprint'
            },
            content: {
              type: 'string',
              description: 'Blueprint content (markdown)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the blueprint file should be created. The blueprint will be saved in the .bluekit directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit.blueprint.getBlueprintDefinition': () => this.handleGetBlueprintDefinition(),
      'bluekit.blueprint.generateBlueprint': (params) => this.handleGenerateBlueprint(params)
    };
  }

  private handleGetBlueprintDefinition(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: this.blueprintDefinition }
    ];
  }

  private handleGenerateBlueprint(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const name = params.name as string;
    const content = params.content as string;
    const projectPath = params.projectPath as string;
    
    if (!name || typeof name !== 'string') {
      throw new Error('name is required and must be a string');
    }

    if (!content || typeof content !== 'string') {
      throw new Error('content is required and must be a string');
    }

    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    // Ensure we have an absolute path
    // Always normalize the path to handle any edge cases with path resolution
    // If projectPath is absolute, normalize it directly
    // If it's relative, resolve it (but this shouldn't happen if projectPath is passed correctly)
    let resolvedProjectPath: string;
    if (path.isAbsolute(projectPath)) {
      resolvedProjectPath = path.normalize(projectPath);
    } else {
      // If relative, resolve from current working directory
      // But warn that this shouldn't typically happen
      resolvedProjectPath = path.resolve(process.cwd(), projectPath);
    }
    
    const bluekitDir = path.join(resolvedProjectPath, '.bluekit');

    try {
      if (!fs.existsSync(bluekitDir)) {
        fs.mkdirSync(bluekitDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const blueprintPath = path.join(bluekitDir, `${name}.md`);
      fs.writeFileSync(blueprintPath, contentWithFrontMatter, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Generated blueprint: ${blueprintPath}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate blueprint: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the blueprint content has YAML front matter. If it doesn't exist, adds a default one.
   */
  private ensureYamlFrontMatter(content: string, blueprintName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and return as-is
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
        // Validate required fields
        if (!frontMatter.id) {
          frontMatter.id = this.generateBlueprintId(blueprintName);
        }
        if (!frontMatter.alias) {
          frontMatter.alias = this.formatBlueprintAlias(blueprintName);
        }
        if (!frontMatter.type) {
          frontMatter.type = 'blueprint';
        }
        if (frontMatter.is_base === undefined) {
          frontMatter.is_base = false;
        }
        if (!frontMatter.version) {
          frontMatter.version = 1;
        }
        if (!frontMatter.tags) {
          frontMatter.tags = [];
        }
        if (!frontMatter.description) {
          frontMatter.description = '';
        }

        // Reconstruct content with validated front matter
        const validatedFrontMatter = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
        const bodyContent = content.substring(match[0].length);
        return `---\n${validatedFrontMatter}\n---\n${bodyContent}`;
      } catch (error) {
        // If YAML parsing fails, replace with valid front matter
        const bodyContent = content.substring(match[0].length);
        return this.createDefaultFrontMatter(blueprintName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(blueprintName) + content;
    }
  }

  /**
   * Creates default YAML front matter for a blueprint
   */
  private createDefaultFrontMatter(blueprintName: string): string {
    const frontMatter = {
      id: this.generateBlueprintId(blueprintName),
      alias: this.formatBlueprintAlias(blueprintName),
      type: 'blueprint',
      is_base: false,
      version: 1,
      tags: [] as string[],
      description: ''
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  /**
   * Generates a blueprint ID from a blueprint name (kebab-case)
   */
  private generateBlueprintId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Formats a blueprint name as a display alias (Title Case)
   */
  private formatBlueprintAlias(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

