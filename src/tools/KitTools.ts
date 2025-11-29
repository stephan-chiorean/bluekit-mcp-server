import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class KitTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_kit_generateKit',
        description: 'Generate a kit file in the .bluekit directory of the specified project path with the generated content. Read the kit definition from MCP resources (bluekit://prompts/get-kit-definition.md) for context, then generate the kit content and use this tool to save it.',
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
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the kit file should be created. The kit will be saved in the .bluekit directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_kit_generateKit': (params) => this.handleGenerateKit(params)
    };
  }

  private handleGenerateKit(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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
    const kitsDir = path.join(bluekitDir, 'kits');

    try {
      if (!fs.existsSync(kitsDir)) {
        fs.mkdirSync(kitsDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const kitPath = path.join(kitsDir, `${name}.md`);
      fs.writeFileSync(kitPath, contentWithFrontMatter, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Generated kit: ${kitPath}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate kit: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the kit content has YAML front matter. If it doesn't exist, adds a default one.
   */
  private ensureYamlFrontMatter(content: string, kitName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and return as-is
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
        // Validate required fields
        if (!frontMatter.id) {
          frontMatter.id = this.generateKitId(kitName);
        }
        if (!frontMatter.alias) {
          frontMatter.alias = this.formatKitAlias(kitName);
        }
        if (!frontMatter.type) {
          frontMatter.type = 'kit';
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
        return this.createDefaultFrontMatter(kitName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(kitName) + content;
    }
  }

  /**
   * Creates default YAML front matter for a kit
   */
  private createDefaultFrontMatter(kitName: string): string {
    const frontMatter = {
      id: this.generateKitId(kitName),
      alias: this.formatKitAlias(kitName),
      type: 'kit',
      is_base: false,
      version: 1,
      tags: [] as string[],
      description: ''
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  /**
   * Generates a kit ID from a kit name (kebab-case)
   */
  private generateKitId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Formats a kit name as a display alias (Title Case)
   */
  private formatKitAlias(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

