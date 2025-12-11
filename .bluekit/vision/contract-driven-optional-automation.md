🌟 BlueKit Vision: Contract-Driven Kits With Optional MCP Automation

## Executive Summary

BlueKit evolves into a system where everything is governed by a simple, predictable contract, and where developers can decide how much automation they want on a per-feature basis.

This creates a workflow that is:

- **Reliable** (UI and structure come from the contract)
- **Flexible** (automation can be turned on/off)
- **Approachable for beginners**
- **Extremely powerful for serious developers**

---

## Part 1: The Vision

### 1. The Contract is the Source of Truth

Every Kit, Walkthrough, Plan, or Diagram begins with a YAML front matter contract.

BlueKit UI reads this contract to decide:

- how to render the item
- how to group it
- how to sort it
- what panels to show
- what metadata to pull up
- how the item connects to other parts of the project

The contract is intentionally small, predictable, and stable.
Cursor and MCP are just producers of files that conform to this contract.

This means:

- You can write contracts by hand
- Cursor can write them
- MCP can write them
- BlueKit always understands them

This is how BlueKit becomes a schema-driven IDE.

2. Automation is Optional, Not Forced

Many AI tools force you into one mode of interacting.
BlueKit does the opposite.

BlueKit introduces a simple Capabilities file that lets users toggle automation per item type:

{
  "kits": "manual",
  "walkthroughs": "manual",
  "diagrams": "mcp",
  "plans": "mcp"
}


This tells Cursor:

"Use MCP for diagram generation."

"Do NOT use MCP for kits — I want full manual control."

"Walkthroughs I prefer to write/generate manually."

"Plans should stay automated."

This system gives developers agency.
Newcomers get easy automation.
Experts get fine-grained control.

3. Two Modes: Manual & MCP
Manual Mode

Cursor behaves like a normal AI assistant.
It generates content directly in the editor, following the contract fields.

Perfect for:

high-touch kit creation

exploratory thinking

writing walkthroughs

artists/power-users who want freedom

MCP Mode

Cursor calls BlueKit's MCP tools for deterministic actions:

saving files

versioning

scaffolding

generating diagrams

creating plans

inserting content in the right location

Perfect for:

consistency

multi-file updates

refactoring

diagram workflows

project-level actions

You get the best of both worlds without conflict.

4. Same Contract, Different Execution Paths

No matter which mode you choose:

The resulting artifact conforms to the same YAML contract

The UI renders the artifact exactly the same

Kits behave the same inside BlueKit

Switching modes doesn't break your project

This removes friction for onboarding while giving experienced engineers a project scaffolding engine they can bend to their will.

5. UX Impact

BlueKit becomes a platform where:

Beginners

Push one button → get kits, diagrams, walkthroughs

UI explains everything

Mistakes are prevented by schema rules

Intermediate Developers

Modify contracts

Customize UI rendering

Mix manual & automated workflows

Advanced Developers

Treat BlueKit like a composable rule engine

Author their own kit types

Disable automation when they need precision

Use Cursor to write structured content but retain full control

This grows with the user — without forcing them into complexity.

6. Why This Is a Big Deal

This hybrid model gives BlueKit a unique position:

🚀 Like a design system, but AI-generated
🧱 Like a framework, but user-authored
🎛️ Like an IDE extension, but fully schema-driven
🤖 Like a coding partner, but optional automation

BlueKit becomes:

A developer-defined system, not an opinionated one

A contract-first environment, not a tool-first one

A safe, organized space for AI-assisted coding

A place where real developers feel in control

A system where onboarding feels simple but depth is infinite

This is what makes BlueKit incredibly sticky for serious devs.

### 7. One Sentence Vision Statement

"BlueKit is a contract-driven development environment where every artifact follows a simple schema, and users choose exactly how much automation they want — from fully manual to fully MCP-powered — without ever breaking the structure of their project."

---

## Part 2: Implementation Details

### System Architecture Overview

Based on the existing BlueKit MCP codebase, here's how we implement the contract-driven, optional automation vision:

**Current State:**
```
bluekit-mcp-server/
├── src/
│   ├── main.ts                 # MCP server entry point
│   ├── BlueKitTools.ts        # Tool aggregator
│   ├── tools/
│   │   ├── BaseToolSet.ts     # Base class for all tool sets
│   │   ├── KitTools.ts        # Kit generation tools
│   │   ├── WalkthroughTools.ts
│   │   ├── AgentTools.ts
│   │   ├── DiagramTools.ts
│   │   └── BlueprintTools.ts
│   ├── schemas/
│   │   └── AppConfig.ts       # Blueprint config schemas
│   └── services/
│       └── MermaidValidatorClient.ts
├── bluekit-prompts/           # MCP resources (definitions)
│   ├── get-kit-definition.md
│   ├── get-walkthrough-definition.md
│   ├── get-agent-definition.md
│   ├── get-diagram-definition.md
│   └── get-blueprint-definition.md
└── .bluekit/                  # User project artifacts
    ├── kits/
    ├── walkthroughs/
    ├── agents/
    ├── diagrams/
    ├── blueprints/
    └── tasks/
```

---

## Implementation Plan

### Phase 1: Capabilities Configuration System

**Goal:** Allow users to configure automation preferences per artifact type.

#### 1.1 Capabilities File Schema

Create a new capabilities configuration file in each BlueKit project:

**Location:** `.bluekit/bluekit.config.json`

```json
{
  "version": "1.0.0",
  "capabilities": {
    "kits": "manual",
    "walkthroughs": "manual",
    "diagrams": "mcp",
    "agents": "mcp",
    "blueprints": "mcp",
    "tasks": "disabled"
  },
  "mcpServer": {
    "enableValidation": true,
    "autoGenerateMetadata": true
  },
  "ui": {
    "theme": "dark",
    "primaryColor": "#4287f5"
  }
}
```

**Automation Modes:**
- `"manual"` - Cursor generates content directly in editor (no MCP tool calls)
- `"mcp"` - Cursor uses MCP tools for deterministic generation
- `"disabled"` - Feature is turned off entirely

#### 1.2 Implementation Files

**New file:** `src/config/CapabilitiesConfig.ts`

```typescript
export interface CapabilitiesConfig {
  version: string;
  capabilities: {
    kits: 'manual' | 'mcp' | 'disabled';
    walkthroughs: 'manual' | 'mcp' | 'disabled';
    diagrams: 'manual' | 'mcp' | 'disabled';
    agents: 'manual' | 'mcp' | 'disabled';
    blueprints: 'manual' | 'mcp' | 'disabled';
    tasks: 'manual' | 'mcp' | 'disabled';
  };
  mcpServer?: {
    enableValidation?: boolean;
    autoGenerateMetadata?: boolean;
  };
  ui?: {
    theme?: 'light' | 'dark';
    primaryColor?: string;
  };
}

export const DefaultCapabilitiesConfig: CapabilitiesConfig = {
  version: '1.0.0',
  capabilities: {
    kits: 'mcp',
    walkthroughs: 'mcp',
    diagrams: 'mcp',
    agents: 'mcp',
    blueprints: 'mcp',
    tasks: 'manual'
  },
  mcpServer: {
    enableValidation: true,
    autoGenerateMetadata: true
  }
};
```

**New file:** `src/tools/CapabilitiesTools.ts`

```typescript
import { BaseToolSet } from './BaseToolSet.js';
import { ToolDefinition, ToolHandler } from '../types.js';
import * as fs from 'fs';
import * as path from 'path';
import { CapabilitiesConfig, DefaultCapabilitiesConfig } from '../config/CapabilitiesConfig.js';

export class CapabilitiesTools extends BaseToolSet {
  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_capabilities_get',
        description: 'Get the current capabilities configuration for a BlueKit project',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            }
          },
          required: ['projectPath']
        }
      },
      {
        name: 'bluekit_capabilities_set',
        description: 'Update capabilities configuration for a BlueKit project',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            },
            config: {
              type: 'object',
              description: 'Partial or full capabilities config to update'
            }
          },
          required: ['projectPath', 'config']
        }
      },
      {
        name: 'bluekit_capabilities_init',
        description: 'Initialize default capabilities configuration for a new BlueKit project',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory'
            }
          },
          required: ['projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_capabilities_get': (params) => this.handleGetCapabilities(params),
      'bluekit_capabilities_set': (params) => this.handleSetCapabilities(params),
      'bluekit_capabilities_init': (params) => this.handleInitCapabilities(params)
    };
  }

  private handleGetCapabilities(params: Record<string, unknown>) {
    const projectPath = params.projectPath as string;
    const configPath = path.join(projectPath, '.bluekit', 'bluekit.config.json');

    if (!fs.existsSync(configPath)) {
      return [{
        type: 'text' as const,
        text: JSON.stringify(DefaultCapabilitiesConfig, null, 2)
      }];
    }

    const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return [{
      type: 'text' as const,
      text: JSON.stringify(config, null, 2)
    }];
  }

  private handleSetCapabilities(params: Record<string, unknown>) {
    // Implementation details...
  }

  private handleInitCapabilities(params: Record<string, unknown>) {
    // Implementation details...
  }
}
```

#### 1.3 Integration with MCP Server

**Update:** `src/main.ts` - Add capabilities instructions

```typescript
const capabilitiesInstructions = `
## Capabilities Configuration

BlueKit supports two modes of operation per artifact type:

1. **Manual Mode** - Generate content directly in the editor
   - You generate the markdown content with YAML front matter
   - You use standard file operations (not MCP tools) to save
   - The contract is the same, but execution is manual

2. **MCP Mode** - Use MCP tools for structured generation
   - Call bluekit_*_createX tools for instructions
   - Call bluekit_*_generateX tools to save with validation
   - Automatic metadata checking and warnings

To check which mode is active for a project:
1. Call bluekit_capabilities_get with the project path
2. Check the capabilities object for the artifact type
3. Use the appropriate workflow based on the mode

Example:
- If capabilities.kits === "manual": Generate markdown directly, save with normal file operations
- If capabilities.kits === "mcp": Use bluekit_kit_createKit and bluekit_kit_generateKit
- If capabilities.kits === "disabled": Do not offer to create kits for this project
`;

this.server = new Server(
  {
    name: 'bluekit',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
      resources: {},
    },
    instructions: existingInstructions + capabilitiesInstructions
  }
);
```

---

### Phase 2: Dual-Mode Tool Implementation

**Goal:** Support both manual and MCP workflows while maintaining the same contract.

#### 2.1 Enhanced Resource Definitions

Update each definition file in `bluekit-prompts/` to include manual mode instructions.

**Example:** `bluekit-prompts/get-kit-definition.md`

```markdown
# Kit Definition

[Existing content...]

## Manual Mode vs MCP Mode

### MCP Mode (Recommended for Consistency)
1. Read this resource to understand kit structure
2. Call `bluekit_kit_createKit` with user description
3. Generate kit content based on instructions
4. Call `bluekit_kit_generateKit` to save with validation

### Manual Mode (Full Control)
1. Read this resource to understand kit structure
2. Generate kit content directly with YAML front matter
3. Save to `.bluekit/kits/{name}.md` using standard file operations
4. Ensure all required fields are filled (tags, description)

**Same Contract, Different Execution:**
- Both modes produce identical `.bluekit/kits/{name}.md` files
- Both use the same YAML front matter schema
- Both are recognized by BlueKit UI
- Switching modes doesn't break existing kits
```

#### 2.2 Contract Validation as Separate Tool

**New file:** `src/tools/ValidationTools.ts`

This allows manual mode users to opt-in to validation without using full MCP generation.

```typescript
export class ValidationTools extends BaseToolSet {
  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_validate_kit',
        description: 'Validate a kit file against the BlueKit contract schema',
        inputSchema: {
          type: 'object',
          properties: {
            filePath: {
              type: 'string',
              description: 'Path to the kit markdown file'
            }
          },
          required: ['filePath']
        }
      },
      {
        name: 'bluekit_validate_walkthrough',
        // Similar for walkthroughs...
      },
      // ... other validation tools
    ];
  }

  private handleValidateKit(params: Record<string, unknown>) {
    const filePath = params.filePath as string;
    const content = fs.readFileSync(filePath, 'utf8');

    const errors: string[] = [];
    const warnings: string[] = [];

    // Check for YAML front matter
    const frontMatterMatch = content.match(/^---\s*\n([\s\S]*?)\n---/);
    if (!frontMatterMatch) {
      errors.push('Missing YAML front matter');
      return this.formatValidationResult(errors, warnings);
    }

    // Parse YAML
    const frontMatter = yaml.load(frontMatterMatch[1]) as Record<string, unknown>;

    // Validate required fields
    if (!frontMatter.id) errors.push('Missing required field: id');
    if (!frontMatter.type || frontMatter.type !== 'kit') {
      errors.push('Missing or invalid type field (must be "kit")');
    }
    if (!frontMatter.tags || !Array.isArray(frontMatter.tags) || frontMatter.tags.length === 0) {
      warnings.push('Tags array is empty or missing');
    }
    if (!frontMatter.description || frontMatter.description.trim() === '') {
      warnings.push('Description is empty or missing');
    }

    return this.formatValidationResult(errors, warnings);
  }

  private formatValidationResult(errors: string[], warnings: string[]) {
    let result = '';

    if (errors.length === 0 && warnings.length === 0) {
      result = '✅ Validation passed - contract is valid';
    } else {
      if (errors.length > 0) {
        result += '❌ Validation errors:\n' + errors.map(e => `  - ${e}`).join('\n');
      }
      if (warnings.length > 0) {
        result += '\n⚠️  Warnings:\n' + warnings.map(w => `  - ${w}`).join('\n');
      }
    }

    return [{ type: 'text' as const, text: result }];
  }
}
```

---

### Phase 3: MCP Server Instructions Enhancement

**Goal:** Make Cursor aware of the dual-mode system and guide it to use the right approach.

#### 3.1 Dynamic Instructions Based on Capabilities

**Update:** `src/main.ts`

```typescript
class BluekitMCPServer {
  // ...

  private async getInstructionsForProject(projectPath?: string): Promise<string> {
    const baseInstructions = this.getBaseInstructions();

    if (!projectPath) {
      return baseInstructions;
    }

    // Load capabilities config
    const configPath = path.join(projectPath, '.bluekit', 'bluekit.config.json');
    let capabilities = DefaultCapabilitiesConfig;

    if (fs.existsSync(configPath)) {
      try {
        capabilities = JSON.parse(fs.readFileSync(configPath, 'utf8'));
      } catch (e) {
        console.error('[MCP] Failed to load capabilities config:', e);
      }
    }

    // Generate mode-specific instructions
    const modeInstructions = this.generateModeInstructions(capabilities);

    return baseInstructions + '\n\n' + modeInstructions;
  }

  private generateModeInstructions(config: CapabilitiesConfig): string {
    let instructions = '## Current Project Capabilities\n\n';

    for (const [artifactType, mode] of Object.entries(config.capabilities)) {
      instructions += `### ${artifactType}:\n`;

      switch (mode) {
        case 'manual':
          instructions += `- Mode: **Manual**\n`;
          instructions += `- Generate content directly in editor\n`;
          instructions += `- Save using standard file operations\n`;
          instructions += `- Must follow the contract schema for ${artifactType}\n\n`;
          break;
        case 'mcp':
          instructions += `- Mode: **MCP Tools**\n`;
          instructions += `- Use bluekit_${artifactType.slice(0, -1)}_create and generate tools\n`;
          instructions += `- Automatic validation and metadata checking\n`;
          instructions += `- Recommended for consistency\n\n`;
          break;
        case 'disabled':
          instructions += `- Mode: **Disabled**\n`;
          instructions += `- Do not offer to create ${artifactType}\n\n`;
          break;
      }
    }

    return instructions;
  }
}
```

---

### Phase 4: Contract Schema Registry

**Goal:** Centralize contract definitions for validation and tooling.

#### 4.1 Schema Registry

**New file:** `src/schemas/ContractSchemas.ts`

```typescript
export interface BaseContract {
  type: string;
}

export interface KitContract extends BaseContract {
  id: string;
  alias: string;
  type: 'kit';
  is_base: boolean;
  version: number;
  tags: string[];
  description: string;
}

export interface WalkthroughContract extends BaseContract {
  id: string;
  alias: string;
  type: 'walkthrough';
  format: 'reference' | 'guide' | 'review' | 'architecture' | 'documentation';
  complexity: 'simple' | 'moderate' | 'comprehensive';
  tags: string[];
  description: string;
}

export interface DiagramContract extends BaseContract {
  alias: string;
  description: string;
  tags: string[];
}

export interface AgentContract extends BaseContract {
  id: string;
  alias: string;
  type: 'agent';
  tags: string[];
  description: string;
  capabilities: string[];
}

// JSON Schemas for validation
export const KitSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    id: { type: "string", pattern: "^[a-z0-9-]+$" },
    alias: { type: "string", minLength: 1 },
    type: { const: "kit" },
    is_base: { type: "boolean" },
    version: { type: "number", minimum: 1 },
    tags: {
      type: "array",
      items: { type: "string" },
      minItems: 1,
      maxItems: 3
    },
    description: { type: "string", minLength: 1 }
  },
  required: ["id", "alias", "type", "is_base", "version", "tags", "description"]
};

// Export registry
export const ContractSchemas = {
  kit: KitSchema,
  walkthrough: WalkthroughSchema,
  diagram: DiagramSchema,
  agent: AgentSchema
};
```

#### 4.2 Schema Validator Service

**New file:** `src/services/ContractValidator.ts`

```typescript
import Ajv from 'ajv';
import { ContractSchemas } from '../schemas/ContractSchemas.js';

export class ContractValidator {
  private ajv: Ajv;

  constructor() {
    this.ajv = new Ajv({ allErrors: true });
  }

  validate(type: string, data: unknown): { valid: boolean; errors: string[]; warnings: string[] } {
    const schema = ContractSchemas[type];
    if (!schema) {
      return {
        valid: false,
        errors: [`Unknown contract type: ${type}`],
        warnings: []
      };
    }

    const valid = this.ajv.validate(schema, data);
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!valid && this.ajv.errors) {
      for (const error of this.ajv.errors) {
        errors.push(`${error.instancePath} ${error.message}`);
      }
    }

    // Additional custom warnings
    if (type === 'kit' && data && typeof data === 'object') {
      const kitData = data as any;
      if (kitData.tags && kitData.tags.length === 0) {
        warnings.push('Tags array should contain 1-3 descriptive tags');
      }
      if (!kitData.description || kitData.description.trim() === '') {
        warnings.push('Description should be a clear, concise sentence');
      }
    }

    return { valid, errors, warnings };
  }
}
```

---

### Phase 5: UI Integration Points

**Goal:** The BlueKit UI app understands and respects capabilities configuration.

#### 5.1 Capabilities API for UI

The UI app should be able to:
1. Read `.bluekit/bluekit.config.json`
2. Show/hide feature buttons based on disabled modes
3. Display mode badges (Manual/MCP/Disabled)
4. Provide UI to toggle capabilities

**Example UI Behavior:**

```typescript
// In BlueKit UI app
interface ProjectCapabilities {
  kits: 'manual' | 'mcp' | 'disabled';
  // ...
}

function KitsPanel({ projectPath, capabilities }: Props) {
  if (capabilities.kits === 'disabled') {
    return <DisabledMessage type="kits" />;
  }

  return (
    <div>
      <ModeBadge mode={capabilities.kits} />
      {capabilities.kits === 'manual' && (
        <ManualModeInfo>
          Create kits manually in .bluekit/kits/ directory
        </ManualModeInfo>
      )}
      {capabilities.kits === 'mcp' && (
        <button onClick={createKitWithMCP}>
          Create Kit (MCP)
        </button>
      )}
      <KitsList />
    </div>
  );
}
```

---

### Phase 6: Migration and Backward Compatibility

**Goal:** Existing BlueKit projects work without modification.

#### 6.1 Default Behavior

**If no `bluekit.config.json` exists:**
- All capabilities default to `"mcp"` mode
- Existing behavior is preserved
- No breaking changes

**Init tool creates default config:**
```typescript
// When running bluekit_init_project
if (!fs.existsSync(configPath)) {
  fs.writeFileSync(
    configPath,
    JSON.stringify(DefaultCapabilitiesConfig, null, 2)
  );
}
```

#### 6.2 Migration Path for Power Users

Users can opt into manual mode gradually:

1. **Start with MCP everywhere** (default)
2. **Try manual mode for kits** (set `capabilities.kits: "manual"`)
3. **Experience both workflows**, decide what works best
4. **Mix and match** per artifact type
5. **Share config** via git (team collaboration)

---

## Summary: What Gets Built

### New Files
```
src/
  config/
    CapabilitiesConfig.ts         # Config schema and defaults
  tools/
    CapabilitiesTools.ts          # Get/set/init capabilities
    ValidationTools.ts            # Validate contracts in manual mode
  schemas/
    ContractSchemas.ts            # JSON schemas for all contracts
  services/
    ContractValidator.ts          # Validation service
```

### Updated Files
```
src/
  main.ts                         # Dynamic instructions based on capabilities
  BlueKitTools.ts                 # Register new tool sets
bluekit-prompts/
  get-kit-definition.md           # Add manual vs MCP sections
  get-walkthrough-definition.md   # Add manual vs MCP sections
  get-agent-definition.md         # Add manual vs MCP sections
  get-diagram-definition.md       # Add manual vs MCP sections
```

### New Project Files
```
.bluekit/
  bluekit.config.json            # User's capabilities configuration
```

---

## The Result

### For Beginners
- **Default MCP mode** provides guardrails
- Automatic validation catches mistakes
- Guided workflow with clear instructions
- Can graduate to manual mode when ready

### For Intermediate Users
- **Mix and match** modes per artifact type
- Use MCP for complex blueprints
- Use manual for quick kits
- Same contracts, different workflows

### For Power Users
- **Full manual control** when needed
- Opt-in to validation
- Write contracts by hand
- Build custom tooling on contracts
- BlueKit becomes a schema, not a straitjacket

### For Teams
- **Shared config** via git
- Team can standardize on MCP mode
- Individual devs can override locally
- Same file structure, regardless of mode

---

## Next Steps

1. **Phase 1:** Implement CapabilitiesConfig and tools
2. **Phase 2:** Update MCP server instructions
3. **Phase 3:** Build ValidationTools for manual mode
4. **Phase 4:** Update resource definitions
5. **Phase 5:** Update BlueKit UI to respect capabilities
6. **Phase 6:** Documentation and migration guide
