import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as yaml from 'js-yaml';
import { loadPrompt } from '../promptLoader.js';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class WalkthroughTools extends BaseToolSet {
  private readonly walkthroughDefinition: string;

  constructor() {
    super();
    this.walkthroughDefinition = loadPrompt('get-walkthrough-definition.md');
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit.walkthrough.getWalkthroughDefinition',
        description: 'Get the full Walkthrough Definition text',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.getWalkthroughDefinition',
        description: 'Get the full Walkthrough Definition text (legacy alias)',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.walkthrough.createWalkthrough',
        description: 'Create a walkthrough from a user description. Analyzes what the user wants to understand and provides instructions for creating a section-by-section, chapter-by-chapter walkthrough that explains how code works.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what they want to understand (e.g., "create a walkthrough for my authentication system", "create a walkthrough for how my payment flow works", "create a walkthrough for understanding my API structure")'
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
        name: 'bluekit.createWalkthrough',
        description: 'Create a walkthrough from a user description (legacy alias)',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what they want to understand (e.g., "create a walkthrough for my authentication system", "create a walkthrough for how my payment flow works", "create a walkthrough for understanding my API structure")'
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
        name: 'bluekit.walkthrough.generateWalkthrough',
        description: 'Generate a walkthrough file in the .bluekit directory of the specified project path with the generated content. Use this after bluekit.walkthrough.createWalkthrough has provided the context and walkthrough content has been generated.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string',
              description: 'Name of the walkthrough'
            },
            content: {
              type: 'string',
              description: 'Walkthrough content (markdown)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the walkthrough file should be created. The walkthrough will be saved in the .bluekit directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      },
      {
        name: 'bluekit.generateWalkthrough',
        description: 'Generate a walkthrough file (legacy alias)',
        inputSchema: {
          type: 'object',
          properties: {
            name: { 
              type: 'string',
              description: 'Name of the walkthrough'
            },
            content: {
              type: 'string',
              description: 'Walkthrough content (markdown)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the walkthrough file should be created. The walkthrough will be saved in the .bluekit directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit.walkthrough.getWalkthroughDefinition': () => this.handleGetWalkthroughDefinition(),
      'bluekit.getWalkthroughDefinition': () => this.handleGetWalkthroughDefinition(), // Legacy alias
      'bluekit.walkthrough.createWalkthrough': (params) => this.handleCreateWalkthrough(params),
      'bluekit.createWalkthrough': (params) => this.handleCreateWalkthrough(params), // Legacy alias
      'bluekit.walkthrough.generateWalkthrough': (params) => this.handleGenerateWalkthrough(params),
      'bluekit.generateWalkthrough': (params) => this.handleGenerateWalkthrough(params) // Legacy alias
    };
  }

  private handleGetWalkthroughDefinition(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: this.walkthroughDefinition }
    ];
  }

  private handleCreateWalkthrough(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();
    
    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# Walkthrough Generation Instructions

## User Request
${description}

## Context for Walkthrough Generation

### Walkthrough Definition
${this.walkthroughDefinition}

## Your Task

Based on the user's description above, analyze what they want to understand and generate a complete walkthrough that:

1. **Breaks down the code** into logical sections and chapters
2. **Explains how things work** step-by-step, section-by-section
3. **Follows the Walkthrough Definition** structure (section-by-section, chapter-by-chapter explanations)
4. **Is educational and clear** with detailed explanations of concepts and code flow
5. **Is complete and comprehensive** covering all relevant parts of the codebase or feature being explained

## Walkthrough File Format

**IMPORTANT**: All walkthroughs MUST start with YAML front matter containing the following fields:

\`\`\`yaml
---
id: <walkthrough-id>
alias: <walkthrough-display-name>
type: walkthrough
is_base: <true|false>
version: <version-number>
tags: [<tag1>, <tag2>, ...]
description: "<walkthrough-description>"
---
\`\`\`

Example:
\`\`\`yaml
---
id: authentication-flow-walkthrough
alias: Authentication Flow Walkthrough
type: walkthrough
is_base: true
version: 1
tags: [authentication, security, flow]
description: "Step-by-step walkthrough explaining how the authentication system works"
---
\`\`\`

The YAML front matter should be followed by the walkthrough content (markdown).

## Project Context
Project path: ${projectPath}

## Next Steps

After generating the walkthrough content with YAML front matter, use the \`bluekit.walkthrough.generateWalkthrough\` tool with the projectPath to save it in the project's .bluekit directory.`;

    return [
      { type: 'text', text: instructions }
    ];
  }

  private handleGenerateWalkthrough(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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

      const walkthroughPath = path.join(bluekitDir, `${name}.md`);
      fs.writeFileSync(walkthroughPath, contentWithFrontMatter, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Generated walkthrough: ${walkthroughPath}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate walkthrough: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the walkthrough content has YAML front matter. If it doesn't exist, adds a default one.
   */
  private ensureYamlFrontMatter(content: string, walkthroughName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and return as-is
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
        // Validate required fields
        if (!frontMatter.id) {
          frontMatter.id = this.generateWalkthroughId(walkthroughName);
        }
        if (!frontMatter.alias) {
          frontMatter.alias = this.formatWalkthroughAlias(walkthroughName);
        }
        if (!frontMatter.type) {
          frontMatter.type = 'walkthrough';
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
        return this.createDefaultFrontMatter(walkthroughName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(walkthroughName) + content;
    }
  }

  /**
   * Creates default YAML front matter for a walkthrough
   */
  private createDefaultFrontMatter(walkthroughName: string): string {
    const frontMatter = {
      id: this.generateWalkthroughId(walkthroughName),
      alias: this.formatWalkthroughAlias(walkthroughName),
      type: 'walkthrough',
      is_base: false,
      version: 1,
      tags: [] as string[],
      description: ''
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  /**
   * Generates a walkthrough ID from a walkthrough name (kebab-case)
   */
  private generateWalkthroughId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Formats a walkthrough name as a display alias (Title Case)
   */
  private formatWalkthroughAlias(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }
}

