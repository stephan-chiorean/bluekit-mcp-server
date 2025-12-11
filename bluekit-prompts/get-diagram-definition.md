A **Diagram** is a mermaid diagram file that visualizes architecture, flows, relationships, or processes in a project. Diagrams are stored as `.mmd` files in the `.bluekit/diagrams` directory and use mermaid syntax for rendering.

A Diagram:

1. **Visualizes system architecture or flows**: Shows how components, processes, or entities relate to each other
2. **Uses mermaid syntax**: Standard mermaid diagram syntax for cross-platform compatibility
3. **Includes metadata**: YAML front matter for categorization and discovery
4. **Is validated**: Syntax is validated before saving to catch errors early
5. **Uses dark theme styling**: Optimized for dark theme rendering with BlueKit color palette

In short:

➡️ A Diagram is a visual representation of system architecture, flows, or relationships using mermaid syntax, stored with metadata for discovery and categorization.

## YAML Front Matter Structure

Every diagram must include YAML front matter with the following fields:

- `alias`: Display name for the diagram (e.g., 'Backend Architecture')
- `description`: **REQUIRED** - A clear, concise description of what the diagram shows (e.g., 'BlueKit Tauri backend architecture showing modules, IPC communication, and file system interactions')
- `tags`: **REQUIRED** - Array of 1-5 descriptive tags (e.g., ['architecture', 'backend', 'tauri', 'rust'])

**CRITICAL**: The `tags` and `description` fields MUST ALWAYS be filled out with meaningful content. NEVER generate a diagram with empty tags or description. These fields are essential for:
- **tags**: Used for filtering and categorization in the UI
- **description**: Provides an overview of what the diagram represents at a glance

## Diagram Content Guidelines

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
- Class assignments for component grouping (via `class NodeA,NodeB className`)
- Meaningful arrows and connections
- Legend or annotations if helpful

## Styling Guidelines

**IMPORTANT**: All diagrams use dark theme rendering. Use `classDef` directives with dark colorful fills from the BlueKit color palette. Choose colors from the palette based on diagram context and codebase structure - there are no prescriptive mappings.

**BlueKit Color Palette** (choose colors based on context):
- **Primary Blue**: `#4287f5` (use for borders, lines, arrows when using primary accent)
- **Dark Blue**: `#1e3a8a`
- **Dark Purple**: `#6b21a8`
- **Dark Teal**: `#0f766e`
- **Dark Orange**: `#c2410c`
- **Dark Indigo**: `#4c1d95`
- **Dark Amber**: `#a16207`
- **Dark Cyan**: `#155e75`
- **Dark Gray**: `#333` (for strokes/borders when not using primary blue)

Styling approach:
- Use `classDef` with colors from the palette above - choose colors that make sense for your diagram's context
- Use dark, vibrant colors that provide good contrast with light text (all palette colors work well)
- Assign classes to nodes using: `class NodeA,NodeB className`
- Use meaningful class names based on the diagram's content and structure
- Different groups/categories in your diagram should use different colors from the palette to help distinguish them visually
- Example format: `classDef group1 fill:#1e3a8a,stroke:#4287f5,stroke-width:2px`

## Common Mermaid Syntax Issues to Avoid

- **@ symbol in node labels**: The @ symbol at the start of node labels causes parse errors. Use "modelcontextprotocol/sdk" instead of "@modelcontextprotocol/sdk"
- **Pipe character (|) in node labels**: The pipe character ANYWHERE in a node label causes parse errors. Use "/" or "," instead. For example, use "light / dark" instead of "light | dark". Note: Pipes are valid in edge labels (-->|label|), only avoid them in node labels.
- **Nested square brackets in node labels**: Square brackets inside node label brackets cause parse errors. Remove the brackets and use plain text. For example, use "item1, item2" instead of "['item1', 'item2']" when inside a node label.
- **Parentheses in node labels**: Parentheses inside node labels cause parse errors because Mermaid uses parentheses for node shapes (rounded rectangles). Remove parentheses or use plain text. For example, use "item1, item2" instead of "(item1, item2)" when inside a node label.
- **Quotes in node labels**: Quotes (single or double) inside node labels can cause parse errors. Remove quotes and use plain text. For example, use "context, viewer" instead of the quoted versions when inside a node label.
- **Special characters at start**: Avoid using @, #, $, %, ^, &, *, backslash, {, }, [, ], <, > at the start of node labels
- **Unclosed brackets**: Ensure all node definitions use proper bracket syntax: NodeID[Label] or NodeID(Label) or NodeID{Label}
- **Invalid edge syntax**: Use proper arrow syntax: -->, -.-->, ==>, --, etc.
- **Unmatched quotes**: Ensure all quoted strings in labels are properly closed

## Example YAML Front Matter

```yaml
---
alias: Backend Architecture
description: BlueKit Tauri backend architecture showing modules, IPC communication, and file system interactions
tags:
  - architecture
  - backend
  - tauri
  - rust
---
```

## Example Complete Diagram

```
---
alias: Simple API Flow
description: Basic flow of an API request through the system
tags:
  - api
  - flow
  - architecture
---

```mermaid
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
```
```

## Validation

Diagrams are automatically validated before saving:
- **Primary**: MCP validation via `@rtuin/mcp-mermaid-validator` (if available)
- **Fallback**: Local regex-based validation with auto-fixes for common issues
- **Auto-fixes**: Automatically fixes common syntax issues like @ symbols, pipe characters, nested brackets, parentheses, and quotes in node labels

## File Location

Diagrams are saved to `.bluekit/diagrams/{name}.mmd` in the specified project path.
