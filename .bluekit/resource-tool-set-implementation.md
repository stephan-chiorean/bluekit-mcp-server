---
id: resource-tool-set-implementation
alias: Resource Tool Set Implementation
is_base: true
version: 1
tags:
  - mcp
  - typescript
  - tool-set
  - resource
  - pattern
description: Reusable pattern for implementing resource tool sets in an MCP server (Kits, Walkthroughs, Blueprints, Collections, etc.) with consistent structure, naming conventions, and helper methods
---
# Resource Tool Set Implementation Kit

This kit provides a complete, reusable pattern for implementing resource tool sets in an MCP server. Use this when creating tools for different resource types (Kits, Walkthroughs, Blueprints, Collections, etc.) to ensure consistency across all implementations.

## Overview

A resource tool set is a class that extends `BaseToolSet` and provides MCP tools for working with a specific resource type. Each resource tool set follows the same structure and patterns, making them easy to implement and maintain.

## File Structure

```
src/
  tools/
    {Resource}Tools.ts          # Main tool set class
  bluekit-prompts/
    get-{resource}-definition.md # Resource definition prompt (if needed)
```

## Implementation Pattern

### 1. Class Structure

```typescript
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';
import { loadPrompt } from '../promptLoader.js'; // If using prompts
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml'; // If handling YAML front matter

export class {Resource}Tools extends BaseToolSet {
  private readonly {resource}Definition: string; // If using definition prompts

  constructor() {
    super();
    // Load prompt if needed
    this.{resource}Definition = loadPrompt('get-{resource}-definition.md');
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      // Tool definitions here
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      // Tool handlers here
    };
  }

  // Handler methods
  // Helper methods
}
```

### 2. Standard Tool Patterns

Each resource tool set should implement these standard tools (adapt as needed):

#### Pattern 1: Get Definition Tool

```typescript
{
  name: 'bluekit.{resource}.get{Resource}Definition',
  description: 'Get the full {Resource} Definition text',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
},
{
  name: 'bluekit.get{Resource}Definition',
  description: 'Get the full {Resource} Definition text (legacy alias)',
  inputSchema: {
    type: 'object',
    properties: {},
    required: []
  }
}
```

**Handler:**
```typescript
private handleGet{Resource}Definition(): Array<{ type: 'text'; text: string }> {
  return [
    { type: 'text', text: this.{resource}Definition }
  ];
}
```

#### Pattern 2: Create Tool

```typescript
{
  name: 'bluekit.{resource}.create{Resource}',
  description: 'Create a {resource} from a user description. Analyzes what the user wants and provides instructions for creating reusable {resource} instructions.',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'User description of what they want to create'
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
  name: 'bluekit.create{Resource}',
  description: 'Create a {resource} from a user description (legacy alias)',
  inputSchema: {
    type: 'object',
    properties: {
      description: {
        type: 'string',
        description: 'User description of what they want to create'
      },
      projectPath: {
        type: 'string',
        description: 'Optional path to the project directory to analyze. If not provided, uses current working directory.'
      }
    },
    required: ['description']
  }
}
```

**Handler Template:**
```typescript
private handleCreate{Resource}(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
  const description = params.description as string;
  const projectPath = (params.projectPath as string) || process.cwd();
  
  if (!description || typeof description !== 'string') {
    throw new Error('description is required and must be a string');
  }

  // Customize this section based on resource-specific needs
  const instructions = `# {Resource} Generation Instructions

## User Request
${description}

## Context for {Resource} Generation

### {Resource} Definition
${this.{resource}Definition}

## Your Task

Based on the user's description above, analyze what they want and generate a complete {resource} that:
[Resource-specific instructions here]

## Project Context
Project path: ${projectPath}

## Next Steps

After generating the {resource} content, use the \`bluekit.{resource}.generate{Resource}\` tool with the projectPath to save it.`;

  return [
    { type: 'text', text: instructions }
  ];
}
```

#### Pattern 3: Generate Tool (for file-based resources)

```typescript
{
  name: 'bluekit.{resource}.generate{Resource}',
  description: 'Generate a {resource} file in the specified location with the generated content.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { 
        type: 'string',
        description: 'Name of the {resource}'
      },
      content: {
        type: 'string',
        description: '{Resource} content (markdown)'
      },
      projectPath: {
        type: 'string',
        description: 'Path to the project directory where the {resource} file should be created.'
      }
    },
    required: ['name', 'content', 'projectPath']
  }
},
{
  name: 'bluekit.generate{Resource}',
  description: 'Generate a {resource} file (legacy alias)',
  inputSchema: {
    type: 'object',
    properties: {
      name: { 
        type: 'string',
        description: 'Name of the {resource}'
      },
      content: {
        type: 'string',
        description: '{Resource} content (markdown)'
      },
      projectPath: {
        type: 'string',
        description: 'Path to the project directory where the {resource} file should be created.'
      }
    },
    required: ['name', 'content', 'projectPath']
  }
}
```

**Handler:**
```typescript
private handleGenerate{Resource}(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
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

  // Resolve absolute path
  let resolvedProjectPath: string;
  if (path.isAbsolute(projectPath)) {
    resolvedProjectPath = path.normalize(projectPath);
  } else {
    resolvedProjectPath = path.resolve(process.cwd(), projectPath);
  }
  
  // Determine target directory (customize based on resource type)
  // Examples:
  // - Kits: path.join(resolvedProjectPath, '.bluekit')
  // - Blueprints: path.join(resolvedProjectPath, '.blueprints')
  // - Walkthroughs: path.join(resolvedProjectPath, '.walkthroughs')
  // - Collections: path.join(resolvedProjectPath, '.collections')
  const targetDir = path.join(resolvedProjectPath, '.{resource}s');

  try {
    if (!fs.existsSync(targetDir)) {
      fs.mkdirSync(targetDir, { recursive: true });
    }

    // Ensure content has YAML front matter if required
    const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

    const filePath = path.join(targetDir, `${name}.md`);
    fs.writeFileSync(filePath, contentWithFrontMatter, 'utf8');

    return [
      {
        type: 'text',
        text: `✅ Generated {resource}: ${filePath}`
      }
    ];
  } catch (error) {
    throw new Error(`Failed to generate {resource}: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

### 3. Handler Registration

Always register both the new format and legacy alias:

```typescript
protected createToolHandlers(): Record<string, ToolHandler> {
  return {
    'bluekit.{resource}.get{Resource}Definition': () => this.handleGet{Resource}Definition(),
    'bluekit.get{Resource}Definition': () => this.handleGet{Resource}Definition(), // Legacy alias
    'bluekit.{resource}.create{Resource}': (params) => this.handleCreate{Resource}(params),
    'bluekit.create{Resource}': (params) => this.handleCreate{Resource}(params), // Legacy alias
    'bluekit.{resource}.generate{Resource}': (params) => this.handleGenerate{Resource}(params),
    'bluekit.generate{Resource}': (params) => this.handleGenerate{Resource}(params) // Legacy alias
  };
}
```

### 4. Helper Methods (for YAML front matter)

If your resource uses YAML front matter, include these helpers:

```typescript
/**
 * Ensures the content has YAML front matter. If it doesn't exist, adds a default one.
 */
private ensureYamlFrontMatter(content: string, resourceName: string): string {
  const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
  const match = content.match(frontMatterRegex);

  if (match) {
    // Front matter exists, validate and return as-is
    try {
      const frontMatter = yaml.load(match[1]) as Record<string, unknown>;
      // Validate required fields (customize based on resource requirements)
      if (!frontMatter.id) {
        frontMatter.id = this.generateResourceId(resourceName);
      }
      if (!frontMatter.alias) {
        frontMatter.alias = this.formatResourceAlias(resourceName);
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
      return this.createDefaultFrontMatter(resourceName) + bodyContent;
    }
  } else {
    // No front matter exists, add default one
    return this.createDefaultFrontMatter(resourceName) + content;
  }
}

/**
 * Creates default YAML front matter for a resource
 */
private createDefaultFrontMatter(resourceName: string): string {
  const frontMatter = {
    id: this.generateResourceId(resourceName),
    alias: this.formatResourceAlias(resourceName),
    is_base: false,
    version: 1,
    tags: [] as string[],
    description: ''
  };

  const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
  return `---\n${yamlContent}\n---\n\n`;
}

/**
 * Generates a resource ID from a resource name (kebab-case)
 */
private generateResourceId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formats a resource name as a display alias (Title Case)
 */
private formatResourceAlias(name: string): string {
  return name
    .split(/[-_\s]+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}
```

## Naming Conventions

### Class Names
- Format: `{Resource}Tools` (e.g., `KitTools`, `WalkthroughTools`, `BlueprintTools`)
- Resource should be singular and PascalCase

### Tool Names
- New format: `bluekit.{resource}.{action}` (e.g., `bluekit.kit.getKitDefinition`)
- Legacy format: `bluekit.{action}` (e.g., `bluekit.getKitDefinition`)
- Resource should be lowercase, singular
- Action should be camelCase

### Method Names
- Format: `handle{Action}{Resource}` (e.g., `handleGetKitDefinition`, `handleCreateWalkthrough`)
- Private helper methods: `ensureYamlFrontMatter`, `createDefaultFrontMatter`, `generateResourceId`, `formatResourceAlias`

### File Names
- Tool set: `{Resource}Tools.ts` (e.g., `KitTools.ts`)
- Prompts: `get-{resource}-definition.md` (e.g., `get-kit-definition.md`)

### Directory Names
- Resource storage: `.{resource}s` (e.g., `.bluekit`, `.blueprints`, `.walkthroughs`)

## Implementation Checklist

When creating a new resource tool set:

- [ ] Create `{Resource}Tools.ts` extending `BaseToolSet`
- [ ] Create prompt file `get-{resource}-definition.md` (if needed)
- [ ] Implement `createToolDefinitions()` with standard tools
- [ ] Implement `createToolHandlers()` with all handlers
- [ ] Add handler methods for each tool
- [ ] Add helper methods (YAML front matter, ID generation, etc.)
- [ ] Register tool set in `BlueKitTools.ts`
- [ ] Test all tools (new format and legacy aliases)
- [ ] Ensure consistent error handling
- [ ] Document resource-specific requirements

## Customization Points

Each resource type may have unique requirements. Customize these areas:

1. **Tool Definitions**: Add resource-specific tools beyond the standard three
2. **Handler Logic**: Customize `handleCreate{Resource}` instructions based on resource type
3. **File Storage**: Adjust target directory and file naming in `handleGenerate{Resource}`
4. **YAML Front Matter**: Modify required fields in `ensureYamlFrontMatter` based on resource schema
5. **Prompt Content**: Create resource-specific definition prompts
6. **Validation**: Add resource-specific validation logic

## Example: Complete Implementation

See `src/tools/KitTools.ts` for a complete reference implementation following this pattern.

## Dependencies

- `BaseToolSet` from `./BaseToolSet.js`
- `ToolDefinition`, `ToolHandler` from `../types.js`
- `loadPrompt` from `../promptLoader.js` (if using prompts)
- `fs`, `path` from Node.js
- `js-yaml` for YAML front matter handling (if needed)

## Notes

- Always provide both new format (`bluekit.{resource}.{action}`) and legacy alias (`bluekit.{action}`) for backward compatibility
- Use consistent error messages and validation patterns
- Ensure all file paths are properly resolved and normalized
- Handle edge cases (missing directories, invalid YAML, etc.)
- Keep helper methods private unless they need to be shared