import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class WalkthroughTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_walkthrough_createWalkthrough',
        description: 'Start the process of creating a new walkthrough. This tool provides instructions for generating a walkthrough with all required metadata (tags, description, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what walkthrough they want to create'
            },
            projectPath: {
              type: 'string',
              description: 'Optional path to the project directory to analyze. If not provided, uses current working directory.'
            },
            complexity: {
              type: 'string',
              enum: ['simple', 'moderate', 'comprehensive'],
              description: 'Complexity level - determines depth and detail. Simple: concise and direct. Moderate: organized sections with examples. Comprehensive: deep dive with multiple sections and detailed analysis. Defaults to moderate if not specified.'
            },
            format: {
              type: 'string',
              enum: ['reference', 'guide', 'review', 'architecture', 'documentation'],
              description: 'Walkthrough format type - determines structure and focus. Reference: quick lookup of key patterns/APIs. Guide: how something was built with implementation details. Review: what changed and why (code reviews). Architecture: how components connect and interact. Documentation: general understanding of how code works. Defaults to documentation if not specified.'
            }
          },
          required: ['description']
        }
      },
      {
        name: 'bluekit_walkthrough_generateWalkthrough',
        description: 'Generate a walkthrough file in the .bluekit directory of the specified project path with the generated content. This should be called AFTER creating the walkthrough content with proper YAML front matter including tags (1-3 descriptive tags) and description (clear, concise sentence).',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the walkthrough'
            },
            content: {
              type: 'string',
              description: 'Walkthrough content (markdown with YAML front matter including filled tags and description)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the walkthrough file should be created. The walkthrough will be saved in the .bluekit directory within this project path.'
            },
            complexity: {
              type: 'string',
              enum: ['simple', 'moderate', 'comprehensive'],
              description: 'Complexity level - determines depth and detail. Simple: concise and direct. Moderate: organized sections with examples. Comprehensive: deep dive with multiple sections and detailed analysis. Defaults to moderate if not specified.'
            },
            format: {
              type: 'string',
              enum: ['reference', 'guide', 'review', 'architecture', 'documentation'],
              description: 'Walkthrough format type - determines structure and focus. Reference: quick lookup of key patterns/APIs. Guide: how something was built with implementation details. Review: what changed and why (code reviews). Architecture: how components connect and interact. Documentation: general understanding of how code works. Defaults to documentation if not specified.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_walkthrough_createWalkthrough': (params) => this.handleCreateWalkthrough(params),
      'bluekit_walkthrough_generateWalkthrough': (params) => this.handleGenerateWalkthrough(params)
    };
  }

  private handleCreateWalkthrough(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();
    const complexity = (params.complexity as string) || 'moderate';
    const format = (params.format as string) || 'documentation';

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# Walkthrough Generation Instructions

## User Request
${description}

## Your Task

Create a complete walkthrough based on the user's description. The walkthrough MUST include proper YAML front matter with ALL required fields filled out:

### Required YAML Front Matter Fields:
- \`id\`: Unique identifier in kebab-case (e.g., 'authentication-flow')
- \`alias\`: Display name in Title Case (e.g., 'Authentication Flow')
- \`type\`: Must be 'walkthrough'
- \`is_base\`: Usually false
- \`version\`: Version number (e.g., 1)
- \`tags\`: **REQUIRED** - Array of 1-3 descriptive tags (e.g., ['authentication', 'security', 'react'])
- \`description\`: **REQUIRED** - A clear, concise sentence describing what this walkthrough covers (e.g., 'Understanding the OAuth2 authentication flow implementation')
- \`complexity\`: '${complexity}'
- \`format\`: '${format}'

**CRITICAL**: Do NOT leave \`tags\` or \`description\` empty! These fields are essential for:
- **tags**: Used for filtering and categorization in the UI
- **description**: Provides an overview of what the walkthrough covers at a glance

### Walkthrough Content Guidelines:
1. **Focused**: Address a specific topic, system, or question
2. **Clear progression**: Information flows logically from context to details
3. **Practical**: Written for builders who need to understand and work with code
4. **Appropriate depth**: Match the complexity (${complexity}) and format (${format}) to the use case

### Complexity Guidelines:
- **Simple**: Direct, concise explanations for straightforward topics
- **Moderate**: Organized sections with code examples and explanations
- **Comprehensive**: Deep dives with multiple sections, flow descriptions, and detailed analysis

### Format Guidelines:
- **Reference**: Quick lookup of key patterns, APIs, or common operations
- **Guide**: How something was built with implementation details and design decisions
- **Review**: What changed, why it matters, what to watch for (code reviews)
- **Architecture**: How components connect and interact, system structure
- **Documentation**: General understanding of how code works

### Example YAML Front Matter:
\`\`\`yaml
---
id: oauth2-auth-flow
alias: OAuth2 Authentication Flow
type: walkthrough
is_base: false
version: 1
tags:
  - authentication
  - oauth2
  - security
description: Understanding the OAuth2 authentication flow implementation with token refresh
complexity: moderate
format: architecture
---
\`\`\`

## Project Context
Project path: ${projectPath}
Complexity: ${complexity}
Format: ${format}

## Next Steps

1. Generate the complete walkthrough content with proper YAML front matter
2. Ensure tags and description are meaningful and filled out
3. Tailor the structure and detail level to match the complexity and format parameters
4. Use the \`bluekit_walkthrough_generateWalkthrough\` tool to save the walkthrough`;

    return [
      { type: 'text', text: instructions }
    ];
  }

  private handleGenerateWalkthrough(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    // Debug: log what we actually received
    console.error('[WalkthroughTools] Received params:', JSON.stringify(params, null, 2));
    console.error('[WalkthroughTools] params.name type:', typeof params.name);
    console.error('[WalkthroughTools] params.name value:', params.name);

    const name = params.name as string;
    const content = params.content as string;
    const projectPath = params.projectPath as string;
    const complexity = (params.complexity as string) || 'moderate';
    const format = (params.format as string) || 'documentation';

    if (!name || typeof name !== 'string') {
      throw new Error(`name is required and must be a string (got: ${typeof name}, value: ${JSON.stringify(name)})`);
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
    const walkthroughsDir = path.join(bluekitDir, 'walkthroughs');

    try {
      if (!fs.existsSync(walkthroughsDir)) {
        fs.mkdirSync(walkthroughsDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name, complexity, format);

      const walkthroughPath = path.join(walkthroughsDir, `${name}.md`);
      fs.writeFileSync(walkthroughPath, contentWithFrontMatter, 'utf8');

      // Check for empty tags or description and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      return [
        {
          type: 'text',
          text: `✅ Generated walkthrough: ${walkthroughPath}${warningText}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate walkthrough: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the walkthrough content has YAML front matter. If it doesn't exist, adds a default one.
   */
  private ensureYamlFrontMatter(content: string, walkthroughName: string, complexity: string, format: string): string {
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
        if (!frontMatter.complexity) {
          frontMatter.complexity = complexity;
        }
        if (!frontMatter.format) {
          frontMatter.format = format;
        }

        // Reconstruct content with validated front matter
        const validatedFrontMatter = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
        const bodyContent = content.substring(match[0].length);
        return `---\n${validatedFrontMatter}\n---\n${bodyContent}`;
      } catch (error) {
        // If YAML parsing fails, replace with valid front matter
        const bodyContent = content.substring(match[0].length);
        return this.createDefaultFrontMatter(walkthroughName, complexity, format) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(walkthroughName, complexity, format) + content;
    }
  }

  /**
   * Creates default YAML front matter for a walkthrough
   */
  private createDefaultFrontMatter(walkthroughName: string, complexity: string, format: string): string {
    const frontMatter = {
      id: this.generateWalkthroughId(walkthroughName),
      alias: this.formatWalkthroughAlias(walkthroughName),
      type: 'walkthrough',
      is_base: false,
      version: 1,
      tags: [] as string[],
      description: '',
      complexity: complexity,
      format: format
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
          warnings.push('Description is empty. Please add a brief description of what this walkthrough covers.');
        }
      } catch (error) {
        // Ignore YAML parsing errors here since they would have been caught earlier
      }
    }

    return warnings;
  }
}

