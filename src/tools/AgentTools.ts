import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { loadPrompt } from '../promptLoader.js';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class AgentTools extends BaseToolSet {
  private readonly agentDefinition: string;

  constructor() {
    super();
    this.agentDefinition = loadPrompt('get-agent-definition.md');
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit.agent.getAgentDefinition',
        description: 'Get the full Agent Definition text',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit.agent.generateAgent',
        description: 'Generate an agent file in the .bluekit directory of the specified project path with the generated content. Use bluekit.agent.getAgentDefinition to get the agent definition for context, then generate the agent content and use this tool to save it.',
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
      'bluekit.agent.getAgentDefinition': () => this.handleGetAgentDefinition(),
      'bluekit.agent.generateAgent': (params) => this.handleGenerateAgent(params)
    };
  }

  private handleGetAgentDefinition(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: this.agentDefinition }
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

    try {
      if (!fs.existsSync(bluekitDir)) {
        fs.mkdirSync(bluekitDir, { recursive: true });
      }

      // Ensure content has YAML front matter with type: agent
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const agentPath = path.join(bluekitDir, `${name}.md`);
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
   */
  private ensureYamlFrontMatter(content: string, agentName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and ensure type is 'agent'
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
        // Validate required fields
        if (!frontMatter.id) {
          frontMatter.id = this.generateAgentId(agentName);
        }
        if (!frontMatter.alias) {
          frontMatter.alias = this.formatAgentAlias(agentName);
        }
        // Ensure type is 'agent'
        frontMatter.type = 'agent';
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
        return this.createDefaultFrontMatter(agentName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(agentName) + content;
    }
  }

  /**
   * Creates default YAML front matter for an agent
   */
  private createDefaultFrontMatter(agentName: string): string {
    const frontMatter = {
      id: this.generateAgentId(agentName),
      alias: this.formatAgentAlias(agentName),
      type: 'agent',
      is_base: false,
      version: 1,
      tags: [] as string[],
      description: ''
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

