A **Blueprint** is a JSON configuration file that organizes multiple Kits and Agents into ordered execution layers.

A Blueprint is saved as JSON in the global `~/.bluekit/blueprintRegistry.json` file (not in the project's `.bluekit` directory).

## Blueprint Structure

A Blueprint has the following JSON structure:

```typescript
{
  id: string;           // Unique identifier (e.g., 'full-stack-app')
  name: string;          // Display name (e.g., 'Full Stack App')
  version: number;       // Version number (e.g., 1)
  description: string;   // Description of what this blueprint does
  layers: Array<{
    id: string;         // Layer identifier (e.g., 'layer-1')
    order: number;       // Execution order (1, 2, 3, ...)
    name: string;        // Layer name (e.g., 'Initialization')
    tasks: Array<{
      id: string;        // Task identifier (e.g., 'task-db')
      alias: string;     // Human-readable task name (e.g., 'Database Setup')
      agent: string;     // Agent reference (e.g., 'backend-ops', 'cursor', 'qa-bot')
      kit: string;       // Kit reference (e.g., 'infra/db-setup', 'frontend/ui-shell')
    }>
  }>
}
```

## Blueprint Purpose

A Blueprint:

1. **Groups multiple Kits together**: Combines related Kits into a cohesive execution plan
2. **Specifies execution order**: Defines which Kits run first, then which run next through ordered layers
3. **References Agents**: Each task specifies which agent should execute the kit
4. **Represents multi-agent, multi-step workflows**: Orchestrates complex, multi-phase development
5. **Defines structure, dependencies, and phases**: Shows how Kits relate and depend on each other

When provided with a user request, references to kits, and references to agents, the agent should generate a blueprint which will be a configuration of grouping agents/kits together in execution layers and tasks as specified.

In short:

➡️ A Blueprint is a JSON configuration that organizes Agents and Kits into ordered execution layers, showing what to run, in what order, and which agent should execute each task.
