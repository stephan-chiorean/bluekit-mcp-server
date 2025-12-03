---
id: adding-mcp-tool
alias: Adding MCP Tool
type: kit
is_base: false
version: 1
tags:
  - mcp
  - typescript
  - tooling
description: A reusable pattern for adding new MCP tools to the BlueKit MCP server following established conventions
---

# Adding MCP Tool

This kit provides a complete pattern for adding new tools to the BlueKit MCP server, based on existing implementations in the codebase.

## Architecture Overview

The BlueKit MCP server follows a modular architecture:

1. **Tool Sets** (`src/tools/*Tools.ts`) - Individual modules for related tools
2. **Base Classes** (`src/tools/BaseToolSet.ts`) - Shared functionality
3. **Main Aggregator** (`src/BlueKitTools.ts`) - Combines all tool sets
4. **Server Entry** (`src/main.ts`) - MCP server initialization

## Step 1: Create Tool Set File

Create a new file `src/tools/{Name}Tools.ts` extending `BaseToolSet`:

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class {Name}Tools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_{namespace}_create{Entity}',
        description: 'Start the process of creating a new {entity}. This tool provides instructions for generating {entity} with all required metadata.',
        inputSchema: {
          type: 'object',
          properties: {
            description: {
              type: 'string',
              description: 'User description of what {entity} they want to create'
            },
            projectPath: {
              type: 'string',
              description: 'Optional path to the project directory. If not provided, uses current working directory.'
            }
          },
          required: ['description']
        }
      },
      {
        name: 'bluekit_{namespace}_generate{Entity}',
        description: 'Generate {entity} file in the .bluekit directory with the generated content. This should be called AFTER creating the content with proper YAML front matter.',
        inputSchema: {
          type: 'object',
          properties: {
            name: {
              type: 'string',
              description: 'Name of the {entity}'
            },
            content: {
              type: 'string',
              description: '{Entity} content (markdown with YAML front matter)'
            },
            projectPath: {
              type: 'string',
              description: 'Path to the project directory where the {entity} file should be created'
            }
          },
          required: ['name', 'content', 'projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_{namespace}_create{Entity}': (params) => this.handleCreate{Entity}(params),
      'bluekit_{namespace}_generate{Entity}': (params) => this.handleGenerate{Entity}(params)
    };
  }

  private handleCreate{Entity}(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const description = params.description as string;
    const projectPath = (params.projectPath as string) || process.cwd();

    if (!description || typeof description !== 'string') {
      throw new Error('description is required and must be a string');
    }

    const instructions = `# {Entity} Generation Instructions

## User Request
${description}

## Your Task

Create a complete {entity} based on the user's description. The {entity} MUST include proper YAML front matter with ALL required fields filled out:

### Required YAML Front Matter Fields:
- \`id\`: Unique identifier in kebab-case (e.g., 'example-{entity}')
- \`alias\`: Display name in Title Case (e.g., 'Example {Entity}')
- \`type\`: Must be '{entity}'
- \`version\`: Version number (e.g., 1)
- \`tags\`: **REQUIRED** - Array of 1-3 descriptive tags
- \`description\`: **REQUIRED** - A clear, concise sentence describing what this {entity} does

### Content Guidelines:
[Add specific guidelines for your entity type]

## Project Context
Project path: ${projectPath}

## Next Steps

1. Generate the complete {entity} content with proper YAML front matter
2. Ensure tags and description are meaningful and filled out
3. Use the \`bluekit_{namespace}_generate{Entity}\` tool to save the {entity}`;

    return [
      { type: 'text', text: instructions }
    ];
  }

  private handleGenerate{Entity}(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const name = params.name as string;
    const content = params.content as string;
    const projectPath = params.projectPath as string;

    // Validation
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

    const bluekitDir = path.join(resolvedProjectPath, '.bluekit');
    const {entities}Dir = path.join(bluekitDir, '{entities}');

    try {
      // Create directory if it doesn't exist
      if (!fs.existsSync({entities}Dir)) {
        fs.mkdirSync({entities}Dir, { recursive: true });
      }

      // Ensure content has YAML front matter
      const contentWithFrontMatter = this.ensureYamlFrontMatter(content, name);

      // Write file
      const {entity}Path = path.join({entities}Dir, `${name}.md`);
      fs.writeFileSync({entity}Path, contentWithFrontMatter, 'utf8');

      // Check for metadata completeness and provide warnings
      const warnings = this.checkMetadataCompleteness(contentWithFrontMatter);
      const warningText = warnings.length > 0 ? '\n⚠️  ' + warnings.join('\n⚠️  ') : '';

      return [
        {
          type: 'text',
          text: `✅ Generated {entity}: ${{{entity}Path}}${warningText}`
        }
      ];
    } catch (error) {
      throw new Error(`Failed to generate {entity}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private ensureYamlFrontMatter(content: string, {entity}Name: string): string {
    const frontMatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n/;
    const match = content.match(frontMatterRegex);

    if (match) {
      try {
        const frontMatter = yaml.load(match[1]) as Record<string, unknown>;

        // Ensure all required fields
        if (!frontMatter.id) {
          frontMatter.id = this.generate{Entity}Id({entity}Name);
        }
        if (!frontMatter.alias) {
          frontMatter.alias = this.format{Entity}Alias({entity}Name);
        }
        if (!frontMatter.type) {
          frontMatter.type = '{entity}';
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

        // Reconstruct content
        const validatedFrontMatter = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
        const bodyContent = content.substring(match[0].length);
        return `---\n${validatedFrontMatter}\n---\n${bodyContent}`;
      } catch (error) {
        const bodyContent = content.substring(match[0].length);
        return this.createDefaultFrontMatter({entity}Name) + bodyContent;
      }
    } else {
      return this.createDefaultFrontMatter({entity}Name) + content;
    }
  }

  private createDefaultFrontMatter({entity}Name: string): string {
    const frontMatter = {
      id: this.generate{Entity}Id({entity}Name),
      alias: this.format{Entity}Alias({entity}Name),
      type: '{entity}',
      version: 1,
      tags: [] as string[],
      description: ''
    };

    const yamlContent = yaml.dump(frontMatter, { lineWidth: -1 }).trim();
    return `---\n${yamlContent}\n---\n\n`;
  }

  private generate{Entity}Id(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  private format{Entity}Alias(name: string): string {
    return name
      .split(/[-_\s]+/)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  }

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
          warnings.push('Description is empty. Please add a brief description.');
        }
      } catch (error) {
        // Ignore YAML parsing errors
      }
    }

    return warnings;
  }
}
```

## Step 2: Register in BlueKitTools

Add to `src/BlueKitTools.ts`:

```typescript
import { {Name}Tools } from './tools/{Name}Tools.js';

export class BlueKitTools {
  private readonly {name}Tools: {Name}Tools;
  // ... other tools

  constructor() {
    this.{name}Tools = new {Name}Tools();
    // ... other tools

    this.commonTools.setToolSets([
      // ... other tool sets
      this.{name}Tools
    ]);

    this.allToolSets = [
      // ... other tool sets
      this.{name}Tools
    ];
  }
}
```

## Step 3: Update BlueKit Desktop App (If Adding New Directory)

If your new entity uses a new directory (e.g., `.bluekit/{entities}/`), you need to update the BlueKit desktop app in two places:

### A. Add directory scanning in `blueKit/src-tauri/src/commands.rs`

In the `get_project_kits` function, add your new directory to be scanned:

```rust
// Read from subdirectories: kits, walkthroughs, agents, tasks, and {entities}
let {entities}_dir = bluekit_path.join("{entities}");
read_md_files_from_dir(&{entities}_dir, &mut kits)?;
```

### B. Exclude from scrapbook in `blueKit/src-tauri/src/commands.rs`

In the `get_scrapbook_items` function, add your directory to the `known_folders` array so it doesn't show up in the scrapbook:

```rust
let known_folders = vec!["kits", "agents", "walkthroughs", "blueprints", "diagrams", "tasks", "{entities}"];
```

Also update the function's documentation comment to list all excluded directories.

## Step 4: Add Type Definitions (Optional)

If your entity has specific structure, add to `src/types.ts`:

```typescript
export interface {Entity} {
  id: string;
  alias: string;
  type: '{entity}';
  version: number;
  tags: string[];
  description: string;
  // Add entity-specific fields
}
```

## Step 5: Create Definition Resource (When Needed)

**When to create a definition resource:**
- Your entity has complex structure or formatting requirements
- You want Claude to understand specific content guidelines
- The entity type is new and needs explanation

**When to skip:**
- Simple entities with straightforward structure
- Tools that just execute actions (no content generation needed)
- The create/generate pattern is self-explanatory

If needed, add `bluekit-prompts/get-{entity}-definition.md`:

```markdown
# {Entity} Definition

## Overview
[Explain what this entity type is used for]

## YAML Front Matter Schema

```yaml
---
id: unique-identifier          # Required: kebab-case identifier
alias: Display Name            # Required: Title Case display name
type: {entity}                 # Required: Entity type
version: 1                     # Required: Version number
tags: [tag1, tag2]            # Required: 1-3 descriptive tags
description: "Brief summary"   # Required: One-line description
---
```

## Content Guidelines
[Explain what should go in the content section]
```

## Step 6: Update Server Instructions (If Definition Resource Created)

**Only if you created a definition resource**, add to `src/main.ts` instructions:

```typescript
### To Generate a {Entity}:
1. Read the resource: bluekit://prompts/get-{entity}-definition.md
2. Generate the {entity} content based on the definition
3. Call bluekit_{namespace}_generate{Entity} with name, content, and projectPath
```

**Otherwise**, the instructions in your `handleCreate{Entity}` method are sufficient.

## Best Practices

1. **Naming Conventions**:
   - Tool names: `bluekit_{namespace}_{action}{Entity}`
   - Class names: `{Name}Tools`
   - File names: `{Name}Tools.ts`

2. **Error Handling**:
   - Always validate input parameters
   - Provide clear error messages
   - Use try-catch for file operations

3. **Path Resolution**:
   - Always resolve to absolute paths
   - Use `path.join()` for cross-platform compatibility
   - Normalize paths before use

4. **YAML Front Matter**:
   - Always validate and ensure all required fields
   - Provide default values when missing
   - Check completeness and warn users

5. **Directory Structure**:
   - Create directories recursively with `{ recursive: true }`
   - Store files in `.bluekit/{entities}/` subdirectory
   - Follow existing patterns for organization

## Testing

After implementation, test with:

```bash
npm run build
node test-ping.js  # Or create a test script
```

## Common Patterns

### Read Existing Files

```typescript
if (!fs.existsSync(filePath)) {
  throw new Error(`File not found: ${filePath}`);
}
const content = fs.readFileSync(filePath, 'utf8');
```

### JSON File Operations

```typescript
const data = JSON.parse(fs.readFileSync(jsonPath, 'utf8'));
fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2), 'utf8');
```

### List Files in Directory

```typescript
if (!fs.existsSync(dir)) {
  return [];
}
const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
```

## Related Kits

- Kit generation patterns (KitTools.ts)
- Agent generation patterns (AgentTools.ts)
- Walkthrough generation patterns (WalkthroughTools.ts)
- Blueprint generation patterns (BlueprintTools.ts)
