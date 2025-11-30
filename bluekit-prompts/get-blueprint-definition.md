A **Blueprint** is a folder containing a `blueprint.json` configuration file and multiple task markdown files.

Blueprints can be stored in two locations:
1. **Local** - Project-specific blueprints in `.bluekit/blueprints/{id}/`
2. **Global** - Referenced in `~/.bluekit/blueprintRegistry.json` for cross-project access

## Blueprint Structure

A Blueprint folder contains:
- `blueprint.json` - Configuration file with metadata and task references
- `{task-name}.md` - Task files (one per task)

### blueprint.json Structure

```typescript
{
  id: string;           // Unique identifier (e.g., 'payment-system-v1')
  name: string;         // Display name (e.g., 'Payment System')
  version: number;      // Version number (e.g., 1)
  description: string;  // Description of what this blueprint does
  createdAt: string;    // ISO timestamp of creation
  layers: Array<{
    id: string;         // Layer identifier (e.g., 'layer-1')
    order: number;      // Execution order (1, 2, 3, ...)
    name: string;       // Layer name (e.g., 'Foundation', 'Core Services')
    tasks: Array<{
      id: string;       // Task identifier (e.g., 'task-db')
      taskFile: string; // Task filename (e.g., 'database-setup.md')
      description: string; // What this task does
    }>
  }>
}
```

### Task File Structure

Task files are markdown documents with instructions for a specific implementation step. They are **blueprint-specific** and **not reusable** - each task is customized for its blueprint's context.

**All task files include YAML front matter with `type: task`** to distinguish them from reusable kits and enable future conversion to kits.

#### Recommended Task File Format

To make tasks "drop and execute", include comprehensive context in each file:

```markdown
---
id: database-setup
type: task
version: 1
blueprint: payment-system-v1
blueprint_name: Payment System
layer: 1
layer_name: Foundation
---

# Task: Database Setup

## Blueprint Context

**Blueprint Goal:** Full payment processing system with Stripe integration

**This Task:** Setup PostgreSQL database for the payment system (Layer 1/3, Task 1/2)

**Task Position:** First task in Foundation layer (prerequisite for API Setup)

## Execution Instructions

When implementing this task:
1. Read all steps before making changes
2. Execute steps sequentially and completely
3. Run verification commands to ensure success
4. Report errors immediately
5. Only proceed after verification passes

## Requirements
- PostgreSQL 14+
- Access to create databases

## Steps

1. Install PostgreSQL
2. Create database 'payment_db'
3. Run migrations
4. Configure connection string

## Verification

Run these commands to verify:
- `psql -l | grep payment_db` - Database exists
- `psql payment_db -c '\dt'` - Tables created

## Completion Criteria

- [ ] PostgreSQL installed
- [ ] Database 'payment_db' created
- [ ] Migrations completed successfully
- [ ] Connection string configured

## Next Steps

After verification passes, proceed to: `api-setup.md` in this layer.
```

#### Minimal Task File Format (also acceptable)

For simpler tasks, the minimal format is:

```markdown
---
id: database-setup
type: task
version: 1
---

# Database Setup

Setup PostgreSQL database for the payment system.

## Requirements
- PostgreSQL 14+

## Steps

1. Install PostgreSQL
2. Create database 'payment_db'
```

**Note:** When using the minimal format, the `bluekit_task_executeTask` tool will automatically inject blueprint context when the task is executed.

## Blueprint Purpose

A Blueprint:

1. **Generates task-specific instructions**: Creates customized markdown files for each implementation step
2. **Organizes into layers**: Groups related tasks that can run in parallel or must run sequentially
3. **Defines execution order**: Layer 1 completes before Layer 2 starts, etc.
4. **Stores everything together**: All tasks live in the same blueprint folder for easy access

## Key Concepts

### Tasks vs Kits
- **Tasks**: Blueprint-specific, live in `.bluekit/blueprints/{id}/`, NOT reusable
- **Kits**: Reusable templates, live in `.bluekit/` root, can be referenced across projects

### Layers - CRITICAL DESIGN PRINCIPLE

**Layers define execution order and parallelization:**

- **Between layers**: Sequential execution - Layer N must complete before Layer N+1 starts
- **Within a layer**: Tasks CAN run in parallel (they are independent of each other)
- **Dependencies**: If tasks have dependencies, they MUST be in separate layers

#### ⚠️ ABSOLUTE RULE: Layer Parallelization

**EVERY task within a layer MUST be executable in parallel with zero dependencies on each other.**

This is NOT a suggestion - it's a hard requirement. If Task B needs ANY output, file, or state from Task A, they CANNOT be in the same layer.

**The Dependency Test:**
```
Can I execute all tasks in this layer simultaneously on different machines
without any task failing due to missing prerequisites from another task?

YES → Layer is valid ✅
NO  → Layer violates parallelization - MUST split ❌
```

#### Task Sizing Philosophy

**Tasks should be comprehensive, focused units - NOT micro-steps.**

Goals:
- **Deterministic execution**: Clear inputs, clear outputs, zero ambiguity
- **Minimal context switching**: Fewer, larger tasks reduce overhead
- **Plug-and-play precision**: Open task → Execute → Verify → Done

Anti-patterns to avoid:
- ❌ Micro-tasks requiring constant file switching ("Create file X", "Import Y", "Add function Z")
- ❌ Tasks that are too granular for practical execution
- ❌ Breaking work into unnecessary small pieces

Good patterns:
- ✅ "Complete Frontend Foundation" - Sets up React, routing, state management, UI library in one focused workflow
- ✅ "Implement Authentication System" - Auth providers, middleware, session handling, protected routes
- ✅ "Build File Operations Module" - All file I/O commands, watchers, error handling together

**Rule of thumb:** If a task requires opening the same files repeatedly or feels fragmented, consolidate it.

#### ⚠️ EXAMPLES: Correct vs Incorrect Layer Design

**INCORRECT ❌** - Tasks have sequential dependencies:
```json
{
  "id": "layer-1",
  "order": 1,
  "name": "Project Setup",
  "tasks": [
    {"taskFile": "create-project.md", "description": "Create project structure"},
    {"taskFile": "configure-project.md", "description": "Configure settings"}
  ]
}
```
**Why it's WRONG:** `configure-project.md` requires the project structure to exist. These are sequential steps.

**CORRECT ✅** - Consolidate into single comprehensive task:
```json
{
  "id": "layer-1",
  "order": 1,
  "name": "Project Initialization",
  "tasks": [
    {"taskFile": "project-setup.md", "description": "Create project structure and configure all settings"}
  ]
}
```
**Why it's CORRECT:** Single comprehensive task handles full initialization - no dependencies, cleaner execution.

---

**INCORRECT ❌** - Backend tasks depend on each other:
```json
{
  "id": "layer-2",
  "order": 2,
  "name": "Backend Setup",
  "tasks": [
    {"taskFile": "rust-modules.md", "description": "Create Rust module files"},
    {"taskFile": "main-entry.md", "description": "Implement main.rs"}
  ]
}
```
**Why it's WRONG:** `main.rs` imports and uses the modules. Module files must exist first.

**CORRECT ✅** - Consolidate into single comprehensive task:
```json
{
  "id": "layer-2",
  "order": 2,
  "name": "Backend Foundation",
  "tasks": [
    {"taskFile": "backend-foundation.md", "description": "Complete Rust backend structure with modules, main entry, and command registration"}
  ]
}
```
**Why it's CORRECT:** One focused task builds entire backend foundation in logical order. No parallelization issues.

---

**INCORRECT ❌** - IPC tasks have cross-language dependency:
```json
{
  "id": "layer-3",
  "order": 3,
  "name": "IPC Layer",
  "tasks": [
    {"taskFile": "rust-commands.md", "description": "Rust IPC handlers"},
    {"taskFile": "typescript-wrappers.md", "description": "TypeScript wrappers"}
  ]
}
```
**Why it's WRONG:** TypeScript wrappers need to match Rust command signatures. Rust must be implemented first.

**CORRECT ✅** - Single comprehensive task:
```json
{
  "id": "layer-3",
  "order": 3,
  "name": "IPC Communication",
  "tasks": [
    {"taskFile": "ipc-system.md", "description": "Complete IPC system with Rust handlers and TypeScript wrappers"}
  ]
}
```
**Why it's CORRECT:** Single task implements both sides of IPC contract together, ensuring consistency.

---

**CORRECT ✅** - Truly independent features:
```json
{
  "id": "layer-4",
  "order": 4,
  "name": "Core Features",
  "tasks": [
    {"taskFile": "user-auth.md", "description": "Complete authentication system"},
    {"taskFile": "payment-processing.md", "description": "Complete payment integration"},
    {"taskFile": "email-service.md", "description": "Complete email notification system"}
  ]
}
```
**Why it's CORRECT:** Each system is completely independent. Can build all three simultaneously on different machines.

#### Validation Checklist

Before finalizing a blueprint, validate EVERY layer:

1. **Dependency Test**: Can all tasks run on separate machines simultaneously?
   - YES → Valid ✅
   - NO → Invalid ❌ (consolidate or split layers)

2. **Output Test**: Does any task consume outputs from another task in the layer?
   - NO → Valid ✅
   - YES → Invalid ❌ (consolidate or split layers)

3. **File Test**: Do tasks modify/create files that other tasks in the layer need?
   - NO → Valid ✅
   - YES → Invalid ❌ (consolidate or split layers)

4. **Execution Order Test**: Does execution order within the layer matter?
   - NO → Valid ✅
   - YES → Invalid ❌ (consolidate or split layers)

If ANY test fails, the layer violates parallelization rules and MUST be restructured.

#### Common Patterns

**Pattern 1: Sequential Foundation Building**
```json
{
  "layers": [
    {"order": 1, "name": "Project Initialization", "tasks": [{"taskFile": "complete-project-setup.md"}]},
    {"order": 2, "name": "Backend Foundation", "tasks": [{"taskFile": "complete-backend-setup.md"}]},
    {"order": 3, "name": "Frontend Foundation", "tasks": [{"taskFile": "complete-frontend-setup.md"}]},
    {"order": 4, "name": "Integration", "tasks": [{"taskFile": "frontend-backend-integration.md"}]}
  ]
}
```

**Pattern 2: Parallel Independent Systems**
```json
{
  "order": 5,
  "name": "Independent Services",
  "tasks": [
    {"taskFile": "authentication-system.md"},
    {"taskFile": "payment-system.md"},
    {"taskFile": "analytics-system.md"}
  ]
}
```

**Pattern 3: Setup → Multiple Implementations → Integration**
```json
{
  "layers": [
    {"order": 1, "name": "Foundation", "tasks": [{"taskFile": "api-foundation.md"}]},
    {"order": 2, "name": "Endpoints", "tasks": [
      {"taskFile": "user-endpoints.md"},
      {"taskFile": "product-endpoints.md"},
      {"taskFile": "order-endpoints.md"}
    ]},
    {"order": 3, "name": "Integration", "tasks": [{"taskFile": "api-integration-tests.md"}]}
  ]
}
```

### Current Implementation (MVP)
- Blueprints generate tasks as markdown files
- Agents are NOT involved yet
- Tasks are executed manually by developers
- Future: Agent-based automated execution

## Usage

### Generating a Blueprint

When generating a blueprint with `bluekit_blueprint_generateBlueprint`:

```typescript
{
  projectPath: '/path/to/project',
  blueprint: {
    id: 'payment-system-v1',
    name: 'Payment System',
    version: 1,
    description: 'Full payment processing system with Stripe',
    layers: [
      {
        id: 'layer-1',
        order: 1,
        name: 'Foundation',
        tasks: [
          {
            id: 'task-db',
            taskFile: 'database-setup.md',
            description: 'PostgreSQL database setup'
          }
        ]
      }
    ]
  },
  tasks: {
    'database-setup.md': '# Database Setup\n\n...'
  },
  saveToGlobal: true  // Optional: save reference to global registry
}
```

This creates:
```
.bluekit/blueprints/payment-system-v1/
├── blueprint.json
└── database-setup.md
```

And if `saveToGlobal: true`, also adds an entry to `~/.bluekit/blueprintRegistry.json`:
```json
{
  "payment-system-v1": {
    "projectPath": "/path/to/project",
    "createdAt": "2025-11-28T..."
  }
}
```

### Listing Blueprints

- `bluekit_blueprint_listBlueprints({ projectPath: '/path' })` - Lists local blueprints only
- `bluekit_blueprint_listBlueprints({ projectPath: '/path', includeGlobal: true })` - Lists both local and global
- `bluekit_blueprint_listBlueprints({})` - Lists global blueprints only

### Getting a Blueprint

- `bluekit_blueprint_getBlueprint({ id: 'blueprint-id', projectPath: '/path' })` - Get from local project
- `bluekit_blueprint_getBlueprint({ id: 'blueprint-id', fromGlobal: true })` - Get from global registry

### Executing a Blueprint Task

Use `bluekit_task_executeTask` to run a specific task with full blueprint context:

```typescript
bluekit_task_executeTask({
  projectPath: '/path/to/project',
  blueprintId: 'payment-system-v1',
  taskFile: 'database-setup.md'
})
```

This tool:
1. Retrieves the task file content
2. Loads blueprint metadata for context
3. Provides execution instructions
4. Shows the task's position in the blueprint
5. Displays completion criteria

**When to use:**
- User provides a task file and says "implement this" or "run this"
- User asks to execute a specific blueprint task
- You need full context about a task's role in the blueprint

## Summary

➡️ A Blueprint is a folder containing a JSON configuration and task markdown files, organizing development work into ordered layers with specific implementation instructions for each step.

➡️ Use `bluekit_task_executeTask` to execute tasks with full blueprint context automatically injected.
