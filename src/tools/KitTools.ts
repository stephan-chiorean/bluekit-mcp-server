import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { loadPrompt } from '../promptLoader.js';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class KitTools extends BaseToolSet {
  private readonly kitDefinition: string;

  constructor() {
    super();
    this.kitDefinition = loadPrompt('get-kit-definition.md');
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit.kit.getKitDefinition',
        description: 'Get the full Kit Definition text',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.getKitDefinition',
        description: 'Get the full Kit Definition text (legacy alias)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.kit.createKit',
        description: 'Create a kit from a user description. Analyzes what the user wants to containerize and provides instructions for creating reusable kit instructions that can be injected into new apps. Returns the kit definition as context for generating the actual kit content.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what they want to containerize into a kit (e.g., "create a kit for my authentication system", "create a kit for all my UI components", "create a kit for my payment flow")'
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
        name: 'bluekit.createKit',
        description: 'Create a kit from a user description (legacy alias)',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what they want to containerize into a kit (e.g., "create a kit for my authentication system", "create a kit for all my UI components", "create a kit for my payment flow")'
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
        name: 'bluekit.kit.generateKit',
        description: 'Generate a kit file in the .bluekit directory of the specified project path with the generated content. Use this after bluekit.kit.createKit has provided the context and kit content has been generated.',
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
      },
      {
        name: 'bluekit.generateKit',
        description: 'Generate a kit file (legacy alias)',
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
      'bluekit.kit.getKitDefinition': () => this.handleGetKitDefinition(),
      'bluekit.getKitDefinition': () => this.handleGetKitDefinition(), // Legacy alias
      'bluekit.kit.createKit': (params) => this.handleCreateKit(params),
      'bluekit.createKit': (params) => this.handleCreateKit(params), // Legacy alias
      'bluekit.kit.generateKit': (params) => this.handleGenerateKit(params),
      'bluekit.generateKit': (params) => this.handleGenerateKit(params) // Legacy alias
    };
  }

  private handleGetKitDefinition(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: this.kitDefinition }
    ];
  }

  private handleCreateKit(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();
    
    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# Kit Generation Instructions

## User Request
${description}

## Context for Kit Generation

### Kit Definition
${this.kitDefinition}

## Your Task

Based on the user's description above, analyze what they want to containerize and generate a complete kit that:

1. **Extracts the essence** of what the user wants to containerize
2. **Creates modular, reusable instructions** that can be injected into new apps
3. **Follows the Kit Definition** structure (components, features, flows, or systems)
4. **Is technology agnostic** and uses tokens for customization
5. **Is complete and self-contained** with full implementations, file paths, dependencies, and setup instructions

## Kit File Format

**IMPORTANT**: All kits MUST start with YAML front matter containing the following fields:

\`\`\`yaml
---
id: <kit-id>
alias: <kit-display-name>
type: kit
is_base: <true|false>
version: <version-number>
tags: [<tag1>, <tag2>, ...]
description: "<kit-description>"
---
\`\`\`

Example:
\`\`\`yaml
---
id: tauri-file-watching
alias: Tauri File Watching
type: kit
is_base: true
version: 1
tags: [tauri, file-system, events]
description: "Pattern for watching files in a Tauri application and updating the frontend"
---
\`\`\`

The YAML front matter should be followed by the kit content (markdown).

## Project Context
Project path: ${projectPath}

## Next Steps

After generating the kit content with YAML front matter, use the \`bluekit.kit.generateKit\` tool with the projectPath to save it in the project's .bluekit directory.`;

    return [
      { type: 'text', text: instructions }
    ];
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

    try {
      if (!fs.existsSync(bluekitDir)) {
        fs.mkdirSync(bluekitDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const kitPath = path.join(bluekitDir, `${name}.md`);
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

