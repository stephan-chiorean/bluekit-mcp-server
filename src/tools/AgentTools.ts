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
        name: 'bluekit_agent_generateAgent',
        description: 'Generate an agent file in the .bluekit directory of the specified project path with the generated content. Read the agent definition from MCP resources (bluekit://prompts/get-agent-definition.md) for context, then generate the agent content and use this tool to save it.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the agent'
            },
            content: {
              type: 'string',
              description: 'Agent content (markdown)'
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
      'bluekit_agent_generateAgent': (params) => this.handleGenerateAgent(params)
    };
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
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const agentPath = path.join(agentsDir, `${name}.md`);
      fs.writeFileSync(agentPath, contentWithFrontMatter, 'utf8');

      return [
        {
          type: 'text',
          text: `✅ Generated agent: ${agentPath}`
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
}

