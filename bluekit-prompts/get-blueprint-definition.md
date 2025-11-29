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

Example task file (`database-setup.md`):
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
- Access to create databases

## Steps

1. Install PostgreSQL
2. Create database 'payment_db'
3. Run migrations
4. Configure connection string

## Environment Variables
- DATABASE_URL=postgresql://localhost:5432/payment_db
```

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

### Layers
- **Sequential execution**: Layer N must complete before Layer N+1 starts
- **Parallel potential**: Tasks within a layer can potentially run in parallel (future feature)

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

## Summary

➡️ A Blueprint is a folder containing a JSON configuration and task markdown files, organizing development work into ordered layers with specific implementation instructions for each step.
