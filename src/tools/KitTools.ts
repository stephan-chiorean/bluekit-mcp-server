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
        name: 'bluekit_kit_createKit',
        description: 'Start the process of creating a new kit. This tool provides instructions for generating a kit with all required metadata (tags, description, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what kit they want to create'
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
        name: 'bluekit_kit_generateKit',
        description: 'Generate a kit file in the .bluekit directory of the specified project path with the generated content. This should be called AFTER creating the kit content with proper YAML front matter including tags (1-3 descriptive tags) and description (clear, concise sentence).',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the kit'
            },
            content: {
              type: 'string',
              description: 'Kit content (markdown with YAML front matter including filled tags and description)'
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
      'bluekit_kit_createKit': (params) => this.handleCreateKit(params),
      'bluekit_kit_generateKit': (params) => this.handleGenerateKit(params)
    };
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

## Your Task

Create a complete kit based on the user's description. The kit MUST include proper YAML front matter with ALL required fields filled out:

### Required YAML Front Matter Fields:
- \`id\`: Unique identifier in kebab-case (e.g., 'react-form-component')
- \`alias\`: Display name in Title Case (e.g., 'React Form Component')
- \`type\`: Must be 'kit'
- \`is_base\`: Usually false
- \`version\`: Version number (e.g., 1)
- \`tags\`: **REQUIRED** - Array of 1-3 descriptive tags (e.g., ['react', 'forms', 'typescript'])
- \`description\`: **REQUIRED** - A clear, concise sentence describing what this kit does (e.g., 'A reusable form component with validation and error handling')

**CRITICAL**: Do NOT leave \`tags\` or \`description\` empty! These fields are essential for:
- **tags**: Used for filtering and categorization in the UI
- **description**: Provides an overview of what the kit does at a glance

### Kit Content Guidelines:
1. Define one coherent unit of work (component, flow, feature, or app)
2. Include complete instructions, code examples, and structure
3. Make it technology-agnostic and adaptable with tokens for customization
4. Ensure it's modular, reusable, and AI-agent ready

### Example YAML Front Matter:
\`\`\`yaml
---
id: react-auth-component
alias: React Auth Component
type: kit
is_base: false
version: 1
tags:
  - react
  - authentication
  - typescript
description: A reusable authentication component with login, logout, and session management
---
\`\`\`

## Project Context
Project path: ${projectPath}

## Next Steps

1. Generate the complete kit content with proper YAML front matter
2. Ensure tags and description are meaningful and filled out
3. Use the \`bluekit_kit_generateKit\` tool to save the kit`;

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
    const kitsDir = path.join(bluekitDir, 'kits');

    try {
      if (!fs.existsSync(kitsDir)) {
        fs.mkdirSync(kitsDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const kitPath = path.join(kitsDir, `${name}.md`);
      fs.writeFileSync(kitPath, contentWithFrontMatter, 'utf8');

      // Check for empty tags or description and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      return [
        {
          type: 'text',
          text: `✅ Generated kit: ${kitPath}${warningText}`
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

  /**
   * Checks if tags and description are properly filled out
   * Returns an array of warning messages
   */
  private checkMetadataCompleteness(content: string): string[] {
    const warnings: string[] = [];
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;

        if (!Array.isArray(frontMatter.tags) || frontMatter.tags.length === 0) {
          warnings.push('Tags are empty. Please add at least 1-3 descriptive tags.');
        }

        if (!frontMatter.description || (typeof frontMatter.description === 'string' && frontMatter.description.trim() === '')) {
          warnings.push('Description is empty. Please add a brief description of what this kit does.');
        }
      } catch (error) {
        // Ignore YAML parsing errors here since they would have been caught earlier
      }
    }

    return warnings;
  }
}

