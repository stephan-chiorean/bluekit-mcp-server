import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler, Agent } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class AgentTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_agent_createAgent',
        description: 'Start the process of creating a new agent. This tool provides instructions for generating an agent with all required metadata (tags, description, capabilities, etc.).',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what agent they want to create'
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
        name: 'bluekit_agent_generateAgent',
        description: 'Generate an agent file in the .bluekit directory of the specified project path with the generated content. This should be called AFTER creating the agent content with proper YAML front matter including tags (1-3 descriptive tags), description (clear, concise sentence), and capabilities (exactly 3 bullet points).',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the agent'
            },
            content: {
              type: 'string',
              description: 'Agent content (markdown with YAML front matter including filled tags, description, and capabilities)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the agent file should be created. The agent will be saved in the .bluekit directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_agent_createAgent': (params) => this.handleCreateAgent(params),
      'bluekit_agent_generateAgent': (params) => this.handleGenerateAgent(params)
    };
  }

  private handleCreateAgent(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# Agent Generation Instructions

## User Request
${description}

## Your Task

Create a complete agent based on the user's description. The agent MUST include proper YAML front matter with ALL required fields filled out:

### Required YAML Front Matter Fields:
- \`id\`: Unique identifier in kebab-case (e.g., 'rust-expert')
- \`alias\`: Display name in Title Case (e.g., 'Rust Expert Developer')
- \`type\`: Must be 'agent'
- \`version\`: Version number (e.g., 1)
- \`description\`: **REQUIRED** - A clear, concise sentence describing the agent's expertise (e.g., 'Expert in Rust systems programming with focus on memory safety and performance')
- \`tags\`: **REQUIRED** - Array of 1-3 descriptive tags (e.g., ['rust', 'systems-programming', 'memory-safety'])
- \`capabilities\`: **REQUIRED** - Array of exactly 3 bullet points describing the agent's key abilities (e.g., ['Full access to local project files', 'Can run MCP tool calls', 'Ideal for: systems kits, performance optimization, low-level programming'])
- \`executionNotes\`: (Optional) Notes about how this agent executes tasks

**CRITICAL**: Do NOT leave \`tags\`, \`description\`, or \`capabilities\` empty! These fields are essential for:
- **tags**: Used for filtering and categorization in the UI
- **description**: Provides an overview of the agent's expertise at a glance
- **capabilities**: Shows what the agent can do and what it's ideal for (must be exactly 3 items)

### Agent Content Guidelines:
An agent defines HOW an expert would think when generating or modifying kits. This is meta-knowledge, not instructions. Include:
- **Style rules**: Coding conventions and patterns to follow
- **Preferred patterns**: Architecture patterns and design approaches
- **Red flags**: Things to avoid or watch out for
- **Quality standards**: Testing, validation, and quality criteria
- **Design philosophies**: Guiding principles and best practices
- **Stack-specific expertise**: Technology-specific guidance
- **Code review heuristics**: What to look for when reviewing
- **Security concerns**: Security best practices for this domain
- **Architecture principles**: Structural and design principles
- **Taste**: Naming conventions, file organization, code style preferences

### Example YAML Front Matter:
\`\`\`yaml
---
id: react-typescript-expert
alias: React TypeScript Expert
type: agent
version: 1
description: Expert in React and TypeScript with focus on type safety, performance, and modern patterns
tags:
  - react
  - typescript
  - frontend
capabilities:
  - Full access to local project files for comprehensive analysis
  - Can run MCP tool calls for code generation and modification
  - Ideal for: React components, TypeScript utilities, modern frontend architecture
executionNotes: Prioritizes type safety and component composition
---
\`\`\`

## Project Context
Project path: ${projectPath}

## Next Steps

1. Generate the complete agent content with proper YAML front matter
2. Ensure tags, description, and capabilities are meaningful and filled out
3. Include exactly 3 capability bullet points
4. Focus on meta-knowledge: how an expert thinks, not step-by-step instructions
5. Use the \`bluekit_agent_generateAgent\` tool to save the agent`;

    return [
      { type: 'text', text: instructions }
    ];
  }

  private handleGenerateAgent(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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
    let resolvedProjectPath: string;
    if (path.isAbsolute(projectPath)) {
      resolvedProjectPath = path.normalize(projectPath);
    } else {
      resolvedProjectPath = path.resolve(process.cwd(), projectPath);
    }
    
    const bluekitDir = path.join(resolvedProjectPath, '.bluekit');
    const agentsDir = path.join(bluekitDir, 'agents');

    try {
      if (!fs.existsSync(agentsDir)) {
        fs.mkdirSync(agentsDir, { recursive: true });
      }

      // Ensure content has YAML front matter with type: agent
      const contentWithFrontMatter = this.ensureFinalNewline(this.ensureYamlFrontMatter(content, name));

      const agentPath = path.join(agentsDir, `${name}.md`);
      fs.writeFileSync(agentPath, contentWithFrontMatter, 'utf8');

      // Check for empty tags, description, or capabilities and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      return [
        {
          type: 'text',
          text: `✅ Generated agent: ${agentPath}${warningText}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate agent: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the agent content has YAML front matter. If it doesn't exist, adds a default one.
   * Validates and ensures all required Agent fields are present.
   */
  private ensureYamlFrontMatter(content: string, agentName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and ensure all required fields
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
        
        // Validate and set required fields
        if (!frontMatter.id || typeof frontMatter.id !== 'string') {
          frontMatter.id = this.generateAgentId(agentName);
        }
        if (!frontMatter.alias || typeof frontMatter.alias !== 'string') {
          frontMatter.alias = this.formatAgentAlias(agentName);
        }
        // Ensure type is 'agent'
        frontMatter.type = 'agent';
        if (typeof frontMatter.version !== 'number') {
          frontMatter.version = 1;
        }
        if (!Array.isArray(frontMatter.tags)) {
          frontMatter.tags = [];
        }
        if (!frontMatter.description || typeof frontMatter.description !== 'string') {
          frontMatter.description = '';
        }
        // Ensure capabilities array exists and validate it
        if (!Array.isArray(frontMatter.capabilities)) {
          frontMatter.capabilities = [];
        }
        // Validate capabilities: should have 3 items, but we don't enforce it here
        // The agent definition prompt instructs to provide 3 capabilities
        // executionNotes is optional, so we don't set it if it's not present

        // Reconstruct content with validated front matter
        const validatedFrontMatter = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
        const bodyContent = content.substring(match[0].length);
        return `---\n${validatedFrontMatter}\n---\n${bodyContent}`;
      } catch (error) {
        // If YAML parsing fails, replace with valid front matter
        const bodyContent = content.substring(match[0].length);
        return this.createDefaultFrontMatter(agentName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(agentName) + content;
    }
  }

  /**
   * Creates default YAML front matter for an agent
   * Matches the Agent interface structure
   */
  private createDefaultFrontMatter(agentName: string): string {
    const frontMatter: Agent = {
      id: this.generateAgentId(agentName),
      alias: this.formatAgentAlias(agentName),
      type: 'agent',
      version: 1,
      description: '',
      tags: [],
      capabilities: []
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  /**
   * Generates an agent ID from an agent name (kebab-case)
   */
  private generateAgentId(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Formats an agent name as a display alias (Title Case)
   */
  private formatAgentAlias(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

  /**
   * Checks if tags, description, and capabilities are properly filled out
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
          warnings.push('Description is empty. Please add a brief description of the agent\'s expertise.');
        }

        if (!Array.isArray(frontMatter.capabilities) || frontMatter.capabilities.length === 0) {
          warnings.push('Capabilities are empty. Please add exactly 3 capability bullet points.');
        } else if (frontMatter.capabilities.length !== 3) {
          warnings.push(`Capabilities should have exactly 3 items (found ${frontMatter.capabilities.length}). Please adjust to 3 bullet points.`);
        }
      } catch (error) {
        // Ignore YAML parsing errors here since they would have been caught earlier
      }
    }

    return warnings;
  }
}

