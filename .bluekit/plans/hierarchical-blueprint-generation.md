# Hierarchical Blueprint Generation

## Problem Statement

When generating blueprints for complex codebases, a single agent can get overwhelmed by:
- Limited context window capacity
- Large, multi-layered architectures
- Need to explore numerous files and dependencies
- Complexity of understanding entire system at once

We need a scalable approach to generate blueprints for arbitrarily complex systems ("stacks on stacks on stacks of layers").

## Solution: Hierarchical Agent Decomposition

### Why This Approach?

1. **Naturally maps to real architecture** - Complex systems are already hierarchical (frontend/backend/infra layers, microservices, modules)
2. **True parallelization** - Sub-agents work simultaneously on different domains
3. **Better context utilization** - Each sub-agent focuses on its domain rather than diluting attention
4. **Composability** - Sub-agents can spawn their own sub-agents recursively
5. **Clearer failure isolation** - Domain failures don't cascade; can retry specific portions
6. **Mirrors human workflows** - Different people own different domains in large projects

## Architecture

### Three-Tier System

1. **Coordinator Agent**
   - Analyzes the blueprint request and codebase structure
   - Identifies natural domain boundaries (directories, imports, conventions)
   - Spawns N sub-agents with focused domain prompts
   - Collects results from all sub-agents
   - Builds dependency graph across domains
   - Performs topological sort to construct layers
   - Produces final blueprint with proper parallelization

2. **Domain Sub-Agents**
   - Explore only their assigned domain
   - Generate tasks with dependency metadata
   - Use consistent naming conventions
   - Return structured task definitions

3. **Optional: Index/Cache Layer**
   - Pre-processes codebase to build lightweight index
   - Provides dependency graphs, component catalogs
   - Helps coordinator make decomposition decisions

## Task Structure

Each sub-agent returns tasks with dependency metadata:

```typescript
{
  domain: "authentication",
  tasks: [
    {
      id: "auth-1",
      content: "Set up user model",
      dependencies: [] // no deps
    },
    {
      id: "auth-2",
      content: "Create login endpoint",
      dependencies: ["auth-1", "database-3"] // depends on own domain + other domain
    }
  ]
}
```

### Dependency Resolution

Sub-agents declare dependencies using:
- **Intra-domain**: `"auth-1"` - depends on task within same domain
- **Cross-domain**: `"database-setup"`, `"api-framework"` - semantic names that coordinator resolves

The coordinator:
1. Collects all tasks from all domains
2. Resolves semantic dependency names to actual task IDs
3. Builds dependency graph
4. Performs topological sort to determine layers

## Layer Construction

The coordinator builds layers based on dependency satisfaction:

- **Layer 1**: All tasks with no dependencies (can run in parallel)
- **Layer 2**: All tasks whose dependencies are satisfied by Layer 1
- **Layer 3**: All tasks whose dependencies are satisfied by Layers 1-2
- **Layer N**: Continue until all tasks are placed

### Example Output

```
Layer 1 (parallel):
  - [database] Create schema
  - [backend] Install dependencies
  - [frontend] Initialize React app

Layer 2 (parallel):
  - [database] Create user table (depends: database-1)
  - [backend] Set up Express (depends: backend-1)
  - [frontend] Set up routing (depends: frontend-1)

Layer 3 (parallel):
  - [backend] Create auth endpoints (depends: database-2, backend-2)
  - [frontend] Create login page (depends: frontend-2, backend-3)
```

## Sub-Agent Instructions

Each sub-agent receives explicit instructions for consistency:

```markdown
You are generating blueprint tasks for the [DOMAIN] domain.

Task requirements:
- Use task IDs with domain prefix: [domain]-1, [domain]-2, etc.
- Each task should be atomic and distinct
- Don't split logically-single operations (e.g., "setup database" is ONE task, not setup + configure separately)
- Review your task list to eliminate redundancy
- Declare dependencies using:
  - Own domain: "auth-1", "auth-2"
  - Other domains: semantic names like "database-setup", "api-framework"
- Ensure consistent, non-redundant naming within your domain
```

### Self-Awareness & Deduplication

Sub-agents must:
- Track what tasks they're defining
- Avoid creating redundant tasks (e.g., "database-setup" AND "database-configuration" for same work)
- Use semantic, atomic task naming
- Review task list before returning to merge duplicates

### Optional: Coordinator Validation

Coordinator could perform validation step:
- Detect suspiciously similar task names across domains
- Ask sub-agents to clarify or merge redundant tasks
- Ensures final blueprint is clean and non-redundant

## Scalability & Recursion

This approach scales infinitely:
- Sub-agents can spawn their own sub-agents if their domain is too complex
- Each level of hierarchy follows the same pattern
- Coordinator at each level merges results from its sub-agents
- Dependency resolution works at any depth

Example:
```
Main Coordinator
├── Frontend Sub-Agent
│   ├── React Components Sub-Agent
│   └── State Management Sub-Agent
├── Backend Sub-Agent
│   ├── API Routes Sub-Agent
│   ├── Database Sub-Agent
│   └── Auth Sub-Agent
└── Infrastructure Sub-Agent
```

## Implementation Considerations

1. **Domain Boundary Detection**: How does coordinator identify domains?
   - Directory structure analysis
   - Import/dependency patterns
   - Convention-based (e.g., `src/frontend`, `src/backend`)
   - User hints/configuration

2. **Cross-Domain Communication**: How do sub-agents know what to depend on?
   - Coordinator provides manifest of available domains
   - Sub-agents use semantic naming conventions
   - Coordinator maintains mapping of semantic names to task IDs

3. **Error Handling**:
   - Sub-agent failures don't block others
   - Coordinator can retry individual domains
   - Partial blueprints can be returned

4. **Performance**:
   - Sub-agents run in parallel (true parallelization)
   - Coordinator overhead is minimal (graph operations)
   - Overall faster than single-agent for large codebases

## Future Enhancements

- **Interactive refinement**: User can review domain decomposition before sub-agents run
- **Learning/caching**: Remember domain boundaries for similar projects
- **Conflict resolution**: Handle circular dependencies or conflicts
- **Incremental updates**: Regenerate only affected domains when codebase changes
