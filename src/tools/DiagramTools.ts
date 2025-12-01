import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

interface Diagram {
  alias: string;
  description: string;
  tags: string[];
}

export class DiagramTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_diagram_createDiagram',
        description: 'Start the process of creating a new mermaid diagram. This tool provides instructions for generating a diagram with all required metadata (alias, description, tags).',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what diagram they want to create'
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
        name: 'bluekit_diagram_generateDiagram',
        description: 'Generate a mermaid diagram file in the .bluekit/diagrams directory of the specified project path. This should be called AFTER creating the diagram content with proper YAML front matter including alias, description, and tags.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the diagram file (without extension, will be saved as .mmd)'
            },
            content: {
              type: 'string',
              description: 'Diagram content (mermaid code with YAML front matter including filled alias, description, and tags)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the diagram file should be created. The diagram will be saved in the .bluekit/diagrams directory within this project path.'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_diagram_createDiagram': (params) => this.handleCreateDiagram(params),
      'bluekit_diagram_generateDiagram': (params) => this.handleGenerateDiagram(params)
    };
  }

  private handleCreateDiagram(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# Diagram Generation Instructions

## User Request
${description}

## Your Task

Create a complete mermaid diagram based on the user's description. The diagram MUST include proper YAML front matter with ALL required fields filled out:

### Required YAML Front Matter Fields:
- \`alias\`: Display name for the diagram (e.g., 'Backend Architecture')
- \`description\`: **REQUIRED** - A clear, concise description of what the diagram shows (e.g., 'BlueKit Tauri backend architecture showing modules, IPC communication, and file system interactions')
- \`tags\`: **REQUIRED** - Array of 1-5 descriptive tags (e.g., ['architecture', 'backend', 'tauri', 'rust'])

**CRITICAL**: Do NOT leave \`tags\` or \`description\` empty! These fields are essential for:
- **tags**: Used for filtering and categorization in the UI
- **description**: Provides an overview of what the diagram represents at a glance

### Diagram Content Guidelines:
Create a valid mermaid diagram that clearly visualizes the requested information. Common diagram types:
- **graph TB/LR**: Flowcharts and architecture diagrams
- **sequenceDiagram**: Interaction and sequence flows
- **classDiagram**: Class structures and relationships
- **erDiagram**: Entity relationship diagrams
- **stateDiagram**: State machines and workflows
- **journey**: User journey maps
- **gantt**: Project timelines

Include:
- Clear node labels and relationships
- Appropriate styling and grouping (subgraphs)
- Color coding for different types of components (classDef)
- Meaningful arrows and connections
- Legend or annotations if helpful

### Example YAML Front Matter:
\`\`\`yaml
---
alias: Backend Architecture
description: BlueKit Tauri backend architecture showing modules, IPC communication, and file system interactions
tags:
  - architecture
  - backend
  - tauri
  - rust
---
\`\`\`

### Example Complete Diagram:
\`\`\`
---
alias: Simple API Flow
description: Basic flow of an API request through the system
tags:
  - api
  - flow
  - architecture
---

\`\`\`mermaid
graph TB
    Client[Client Application]
    API[API Gateway]
    Service[Backend Service]
    DB[(Database)]

    Client -->|HTTP Request| API
    API -->|Route| Service
    Service -->|Query| DB
    DB -->|Data| Service
    Service -->|Response| API
    API -->|HTTP Response| Client

    classDef client fill:#e1f5ff,stroke:#01579b
    classDef backend fill:#c8e6c9,stroke:#2e7d32
    classDef data fill:#f3e5f5,stroke:#6a1b9a

    class Client client
    class API,Service backend
    class DB data
\`\`\`

## Project Context
Project path: ${projectPath}

## Next Steps

1. Generate the complete diagram content with proper YAML front matter
2. Ensure tags and description are meaningful and filled out
3. Create a valid mermaid diagram that clearly represents the requested information
4. Use appropriate diagram type and styling
5. Use the \`bluekit_diagram_generateDiagram\` tool to save the diagram`;

    return [
      { type: 'text', text: instructions }
    ];
  }

  private handleGenerateDiagram(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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
    const diagramsDir = path.join(bluekitDir, 'diagrams');

    try {
      if (!fs.existsSync(diagramsDir)) {
        fs.mkdirSync(diagramsDir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      const diagramPath = path.join(diagramsDir, `${name}.mmd`);
      fs.writeFileSync(diagramPath, contentWithFrontMatter, 'utf8');

      // Check for empty tags and description and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      return [
        {
          type: 'text',
          text: `✅ Generated diagram: ${diagramPath}${warningText}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate diagram: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Ensures the diagram content has YAML front matter. If it doesn't exist, adds a default one.
   * Validates and ensures all required Diagram fields are present.
   */
  private ensureYamlFrontMatter(content: string, diagramName: string): string {
    // Check if content already has YAML front matter
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      // Front matter exists, validate and ensure all required fields
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;

        // Validate and set required fields
        if (!frontMatter.alias || typeof frontMatter.alias !== 'string') {
          frontMatter.alias = this.formatDiagramAlias(diagramName);
        }
        if (!frontMatter.description || typeof frontMatter.description !== 'string') {
          frontMatter.description = '';
        }
        if (!Array.isArray(frontMatter.tags)) {
          frontMatter.tags = [];
        }

        // Reconstruct content with validated front matter
        const validatedFrontMatter = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
        const bodyContent = content.substring(match[0].length);
        return `---\n${validatedFrontMatter}\n---\n${bodyContent}`;
      } catch (error) {
        // If YAML parsing fails, replace with valid front matter
        const bodyContent = content.substring(match[0].length);
        return this.createDefaultFrontMatter(diagramName) + bodyContent;
      }
    } else {
      // No front matter exists, add default one
      return this.createDefaultFrontMatter(diagramName) + content;
    }
  }

  /**
   * Creates default YAML front matter for a diagram
   * Matches the Diagram interface structure
   */
  private createDefaultFrontMatter(diagramName: string): string {
    const frontMatter: Diagram = {
      alias: this.formatDiagramAlias(diagramName),
      description: '',
      tags: []
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  /**
   * Formats a diagram name as a display alias (Title Case)
   */
  private formatDiagramAlias(name: string): string {
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
          warnings.push('Tags are empty. Please add at least 1-5 descriptive tags.');
        }

        if (!frontMatter.description || (typeof frontMatter.description === 'string' && frontMatter.description.trim() === '')) {
          warnings.push('Description is empty. Please add a brief description of what the diagram shows.');
        }
      } catch (error) {
        // Ignore YAML parsing errors here since they would have been caught earlier
      }
    }

    return warnings;
  }
}
