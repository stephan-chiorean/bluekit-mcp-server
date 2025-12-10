import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';
import { MermaidValidatorClient } from '../services/MermaidValidatorClient.js';

interface Diagram {
  alias: string;
  description: string;
  tags: string[];
}

export class DiagramTools extends BaseToolSet {
  private validatorClient: MermaidValidatorClient;

  constructor() {
    super();
    this.validatorClient = new MermaidValidatorClient();
    // Initialize validator in background - don't block construction
    this.validatorClient.initialize().catch(err =>
      console.error('[DiagramTools] Validator initialization failed:', err)
    );
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
- Class assignments for component grouping (via \`class NodeA,NodeB className\`)
- Meaningful arrows and connections
- Legend or annotations if helpful

### Styling Guidelines:
**IMPORTANT**: All diagrams use dark theme rendering. Use \`classDef\` directives with dark colorful fills from the BlueKit color palette. Choose colors from the palette based on diagram context and codebase structure - there are no prescriptive mappings.

**BlueKit Color Palette** (choose colors based on context):
- **Primary Blue**: \`#4287f5\` (use for borders, lines, arrows when using primary accent)
- **Dark Blue**: \`#1e3a8a\`
- **Dark Purple**: \`#6b21a8\`
- **Dark Teal**: \`#0f766e\`
- **Dark Orange**: \`#c2410c\`
- **Dark Indigo**: \`#4c1d95\`
- **Dark Amber**: \`#a16207\`
- **Dark Cyan**: \`#155e75\`
- **Dark Gray**: \`#333\` (for strokes/borders when not using primary blue)

Styling approach:
- Use \`classDef\` with colors from the palette above - choose colors that make sense for your diagram's context
- Use dark, vibrant colors that provide good contrast with light text (all palette colors work well)
- Assign classes to nodes using: \`class NodeA,NodeB className\`
- Use meaningful class names based on the diagram's content and structure
- Different groups/categories in your diagram should use different colors from the palette to help distinguish them visually
- Example format: \`classDef group1 fill:#1e3a8a,stroke:#4287f5,stroke-width:2px\`

### Common Mermaid Syntax Issues to Avoid:
- **@ symbol in node labels**: The @ symbol at the start of node labels causes parse errors. Use "modelcontextprotocol/sdk" instead of "@modelcontextprotocol/sdk"
- **Pipe character (|) in node labels**: The pipe character ANYWHERE in a node label causes parse errors. Use "/" or "," instead. For example, use "light / dark" instead of "light | dark". Note: Pipes are valid in edge labels (-->|label|), only avoid them in node labels.
- **Nested square brackets in node labels**: Square brackets inside node label brackets cause parse errors. Remove the brackets and use plain text. For example, use "item1, item2" instead of "['item1', 'item2']" when inside a node label.
- **Parentheses in node labels**: Parentheses inside node labels cause parse errors because Mermaid uses parentheses for node shapes (rounded rectangles). Remove parentheses or use plain text. For example, use "item1, item2" instead of "(item1, item2)" when inside a node label.
- **Quotes in node labels**: Quotes (single or double) inside node labels can cause parse errors. Remove quotes and use plain text. For example, use "context, viewer" instead of the quoted versions when inside a node label.
- **Special characters at start**: Avoid using @, #, $, %, ^, &, *, backslash, {, }, [, ], <, > at the start of node labels
- **Unclosed brackets**: Ensure all node definitions use proper bracket syntax: NodeID[Label] or NodeID(Label) or NodeID{Label}
- **Invalid edge syntax**: Use proper arrow syntax: -->, -.-->, ==>, --, etc.
- **Unmatched quotes**: Ensure all quoted strings in labels are properly closed

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
    subgraph UI["🖥️ UI Layer"]
        Client[Client Application]
    end
    
    subgraph API["🔌 API Layer"]
        API[API Gateway]
    end
    
    subgraph Backend["🦀 Backend Layer"]
        Service[Backend Service]
        DB[(Database)]
    end

    Client -->|HTTP Request| API
    API -->|Route| Service
    Service -->|Query| DB
    DB -->|Data| Service
    Service -->|Response| API
    API -->|HTTP Response| Client

    %% Define classes using colors from BlueKit palette (chosen based on diagram context)
    classDef clientGroup fill:#1e3a8a,stroke:#4287f5,stroke-width:2px
    classDef apiGroup fill:#0f766e,stroke:#4287f5,stroke-width:2px
    classDef serviceGroup fill:#6b21a8,stroke:#4287f5,stroke-width:2px
    
    %% Assign classes to nodes - colors work well in dark theme
    class Client clientGroup
    class API apiGroup
    class Service,DB serviceGroup
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

  private async handleGenerateDiagram(params: Record<string, unknown>): Promise<Array<{ type: 'text'; text: string }>> {
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
      let contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      // Extract mermaid code for validation
      const mermaidCode = this.extractMermaidCode(contentWithFrontMatter);

      // Validate with MCP (primary) or fallback to regex validation
      let usedFallback = false;
      const validationResult = await this.validateWithMCP(mermaidCode)
        .catch(err => {
          console.error('[DiagramTools] MCP validation unavailable, using fallback:', err);
          usedFallback = true;
          return this.validateMermaidSyntax(contentWithFrontMatter);
        });

      // Apply auto-fixes if using fallback validation
      if ('fixedContent' in validationResult && validationResult.fixedContent) {
        contentWithFrontMatter = validationResult.fixedContent;
      }

      // Check for validation errors
      const isValid = 'isValid' in validationResult ? validationResult.isValid : validationResult.errors.length === 0;
      const errors = validationResult.errors || [];

      if (!isValid && errors.length > 0) {
        // Filter out auto-fixable errors if using fallback
        const unfixableErrors = usedFallback && 'fixedContent' in validationResult
          ? errors.filter(e =>
              !e.includes('@ symbol at start of label') &&
              !e.includes('Pipe character "|" in label') &&
              !e.includes('Nested square brackets in label') &&
              !e.includes('Parentheses in label') &&
              !e.includes('Quotes in label')
            )
          : errors;

        if (unfixableErrors.length > 0) {
          throw new Error(
            `Mermaid syntax validation failed:\n\n${unfixableErrors.join('\n\n')}\n\n` +
            `Please fix these errors and try again.`
          );
        }
      }

      const diagramPath = path.join(diagramsDir, `${name}.mmd`);
      const finalContent = this.ensureFinalNewline(contentWithFrontMatter);
      fs.writeFileSync(diagramPath, finalContent, 'utf8');

      // Check for empty tags and description and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      // Check if we auto-fixed any issues (only applicable for fallback validation)
      const autoFixedCount = usedFallback && 'fixedContent' in validationResult && validationResult.errors
        ? validationResult.errors.filter(e =>
            e.includes('@ symbol at start of label') ||
            e.includes('Pipe character "|" in label') ||
            e.includes('Nested square brackets in label') ||
            e.includes('Parentheses in label') ||
            e.includes('Quotes in label')
          ).length
        : 0;
      const autoFixText = autoFixedCount > 0
        ? `\n🔧 Auto-fixed ${autoFixedCount} mermaid syntax issue(s) (@ symbols, pipes, brackets, etc.).`
        : '';

      // Indicate validation method used
      const validationMethod = usedFallback ? 'fallback' : 'MCP';
      const validationText = `\n✓ Validated with ${validationMethod} validator`;

      return [
        {
          type: 'text',
          text: `✅ Generated diagram: ${diagramPath}${validationText}${autoFixText}${warningText}`
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

  /**
   * Validates mermaid syntax and detects common parse errors
   * Returns errors and optionally fixed content
   */
  private validateMermaidSyntax(content: string): {
    errors: string[];
    fixedContent?: string;
  } {
    const errors: string[] = [];
    let fixedContent = content;

    // Extract mermaid code block
    const mermaidBlockRegex = /```mermaid\s*\n([\s\S]*?)```/;
    const mermaidMatch = content.match(mermaidBlockRegex);
    
    if (!mermaidMatch) {
      // Check if content is just mermaid code without markdown code block
      // In that case, validate the entire content after YAML front matter
      const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
      const frontMatterMatch = content.match(frontMatterRegex);
      if (frontMatterMatch) {
        const mermaidCode = content.substring(frontMatterMatch[0].length);
        return this.validateMermaidCode(mermaidCode, errors, fixedContent);
      }
      return { errors: ['No mermaid code block found'] };
    }

    const mermaidCode = mermaidMatch[1];
    return this.validateMermaidCode(mermaidCode, errors, fixedContent, mermaidMatch[0]);
  }

  /**
   * Validates mermaid code for common syntax errors
   */
  private validateMermaidCode(
    mermaidCode: string,
    errors: string[],
    fixedContent: string,
    originalBlock?: string
  ): { errors: string[]; fixedContent?: string } {
    let fixedMermaidCode = mermaidCode;
    let hasFixes = false;

    // Check for @ symbol at start of node labels (common parse error)
    // Pattern: NodeID[@something...] - @ at start of label causes parse error
    const atSymbolPattern = /(\w+)\[(@[^\]]+)\]/g;
    const atSymbolMatches = Array.from(mermaidCode.matchAll(atSymbolPattern));
    
    if (atSymbolMatches.length > 0) {
      for (const match of atSymbolMatches) {
        const nodeId = match[1];
        const label = match[2];
        const fixedLabel = label.replace(/^@/, ''); // Remove @ from start
        errors.push(
          `Line with node "${nodeId}": @ symbol at start of label "${label}" causes parse errors. Use "${fixedLabel}" instead.`
        );
        fixedMermaidCode = fixedMermaidCode.replace(match[0], `${nodeId}[${fixedLabel}]`);
        hasFixes = true;
      }
    }

    // Check for pipe characters in node labels (causes parse errors)
    // Pattern: NodeID[...|...] - pipe anywhere in label causes parse error
    // Note: Pipes are valid in edge labels (-->|label|) so we only check node labels
    const pipeInLabelPattern = /(\w+)\[([^\]]*\|[^\]]*)\]/g;
    const pipeMatches = Array.from(mermaidCode.matchAll(pipeInLabelPattern));
    
    if (pipeMatches.length > 0) {
      for (const match of pipeMatches) {
        const nodeId = match[1];
        const label = match[2];
        const fixedLabel = label.replace(/\s*\|\s*/g, ' / '); // Replace pipes with forward slashes
        errors.push(
          `Line with node "${nodeId}": Pipe character "|" in label "${label}" causes parse errors. Use "${fixedLabel}" instead.`
        );
        fixedMermaidCode = fixedMermaidCode.replace(match[0], `${nodeId}[${fixedLabel}]`);
        hasFixes = true;
      }
    }

    // Check for nested square brackets in node labels (causes parse errors)
    // Pattern: NodeID[...[...]...] - nested brackets confuse the parser
    // We need to match brackets that are inside node label brackets
    // This is tricky because we need to find [ inside [ ... ]
    const nestedBracketPattern = /(\w+)\[([^\]]*\[[^\]]*)\]/g;
    const nestedBracketMatches = Array.from(mermaidCode.matchAll(nestedBracketPattern));
    
    if (nestedBracketMatches.length > 0) {
      for (const match of nestedBracketMatches) {
        const nodeId = match[1];
        const label = match[2];
        // Replace square brackets with plain text (remove brackets, keep content)
        // For arrays like ['item1', 'item2'], convert to "item1", "item2"
        let fixedLabel = label;
        // Remove outer brackets from array notation
        fixedLabel = fixedLabel.replace(/\[([^\]]+)\]/g, '$1');
        // Clean up any remaining brackets
        fixedLabel = fixedLabel.replace(/\[/g, '').replace(/\]/g, '');
        errors.push(
          `Line with node "${nodeId}": Nested square brackets in label "${label}" cause parse errors. Removed brackets: "${fixedLabel}"`
        );
        fixedMermaidCode = fixedMermaidCode.replace(match[0], `${nodeId}[${fixedLabel}]`);
        hasFixes = true;
      }
    }

    // Check for parentheses in node labels (causes parse errors - parentheses are used for node shapes)
    // Pattern: NodeID[...(...)...] - parentheses inside square brackets confuse the parser
    const parenInLabelPattern = /(\w+)\[([^\]]*\([^\]]*\)[^\]]*)\]/g;
    const parenMatches = Array.from(mermaidCode.matchAll(parenInLabelPattern));
    
    if (parenMatches.length > 0) {
      for (const match of parenMatches) {
        const nodeId = match[1];
        const label = match[2];
        // Replace parentheses with plain text (remove parens, keep content)
        const fixedLabel = label.replace(/\(/g, '').replace(/\)/g, '');
        errors.push(
          `Line with node "${nodeId}": Parentheses in label "${label}" cause parse errors (parentheses are used for node shapes). Removed parentheses: "${fixedLabel}"`
        );
        fixedMermaidCode = fixedMermaidCode.replace(match[0], `${nodeId}[${fixedLabel}]`);
        hasFixes = true;
      }
    }

    // Check for quotes in node labels (can cause parse errors)
    // Pattern: NodeID[..."...] or NodeID[...'...] - quotes inside square brackets can confuse the parser
    const quoteInLabelPattern = /(\w+)\[([^\]]*["'][^\]]*)\]/g;
    const quoteMatches = Array.from(mermaidCode.matchAll(quoteInLabelPattern));
    
    if (quoteMatches.length > 0) {
      for (const match of quoteMatches) {
        const nodeId = match[1];
        const label = match[2];
        // Remove quotes but keep content
        const fixedLabel = label.replace(/["']/g, '');
        errors.push(
          `Line with node "${nodeId}": Quotes in label "${label}" may cause parse errors. Removed quotes: "${fixedLabel}"`
        );
        fixedMermaidCode = fixedMermaidCode.replace(match[0], `${nodeId}[${fixedLabel}]`);
        hasFixes = true;
      }
    }

    // Check for other problematic special characters at start of labels
    const problematicStartChars = /(\w+)\[([#\$%\^\&\*\\\{\}\[\]<>][^\]]+)\]/g;
    const problematicMatches = Array.from(mermaidCode.matchAll(problematicStartChars));
    
    if (problematicMatches.length > 0) {
      for (const match of problematicMatches) {
        const nodeId = match[1];
        const label = match[2];
        errors.push(
          `Line with node "${nodeId}": Special character at start of label "${label}" may cause parse errors. Consider quoting or escaping.`
        );
      }
    }

    // Check for unclosed brackets in node definitions (more accurate check)
    const lines = mermaidCode.split('\n');
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Look for node definitions with opening bracket but no closing bracket on same line
      const nodeDefMatch = line.match(/(\w+)\[([^\]]*)$/);
      if (nodeDefMatch && !line.includes(']')) {
        // Check if closing bracket exists in next few lines (for multi-line definitions)
        let foundClosing = false;
        for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
          if (lines[j].includes(']')) {
            foundClosing = true;
            break;
          }
        }
        if (!foundClosing) {
          errors.push(`Line ${i + 1}: Potentially unclosed bracket in node definition: "${line}"`);
        }
      }
    }

    // Check for unmatched quotes in labels (simplified check)
    const singleQuoteCount = (mermaidCode.match(/'/g) || []).length;
    const doubleQuoteCount = (mermaidCode.match(/"/g) || []).length;
    if (singleQuoteCount % 2 !== 0) {
      errors.push('Unmatched single quotes detected in mermaid code');
    }
    if (doubleQuoteCount % 2 !== 0) {
      errors.push('Unmatched double quotes detected in mermaid code');
    }

    // Apply fixes if any were made
    if (hasFixes && originalBlock) {
      fixedContent = fixedContent.replace(originalBlock, `\`\`\`mermaid\n${fixedMermaidCode}\`\`\``);
    } else if (hasFixes) {
      // If no original block, we're working with raw mermaid code
      const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
      const frontMatterMatch = fixedContent.match(frontMatterRegex);
      if (frontMatterMatch) {
        fixedContent = fixedContent.substring(0, frontMatterMatch[0].length) + fixedMermaidCode;
      }
    }

    return {
      errors,
      fixedContent: hasFixes ? fixedContent : undefined
    };
  }

  /**
   * Validate mermaid code using MCP validator
   * Returns structured validation result
   */
  private async validateWithMCP(mermaidCode: string): Promise<{
    isValid: boolean;
    errors?: string[];
  }> {
    try {
      const result = await this.validatorClient.validate(mermaidCode);
      return {
        isValid: result.isValid,
        errors: result.errors
      };
    } catch (error) {
      // Re-throw to trigger fallback
      throw error;
    }
  }

  /**
   * Extract mermaid code from diagram content
   * Handles both markdown-wrapped and raw mermaid code
   */
  private extractMermaidCode(content: string): string {
    // Remove YAML front matter
    let cleaned = content.replace(/^---\s*\n[\s\S]*?\n---\s*\n?/, '');

    // Try to match mermaid code block: ```mermaid ... ```
    const mermaidBlockMatch = cleaned.match(/```mermaid\s*\n([\s\S]*?)\n?```/);
    if (mermaidBlockMatch) {
      return mermaidBlockMatch[1].trim();
    }

    // Try generic code block: ``` ... ```
    const genericBlockMatch = cleaned.match(/```\s*\n([\s\S]*?)\n?```/);
    if (genericBlockMatch) {
      return genericBlockMatch[1].trim();
    }

    // Assume raw mermaid code
    return cleaned.trim();
  }
}
