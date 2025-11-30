An **Agent** is a markdown file that defines HOW an expert would think when generating or modifying kits.

This is meta-knowledge, not instructions.

This is the mental model, guiding heuristics, preferred patterns, and best practices for a particular persona/expert.

An agent.md should contain:

- **Style rules** ("Always separate domain logic from UI logic")
- **Preferred patterns** ("Use repository pattern for data access")
- **Red flags** ("Avoid mutable shared state")
- **Quality standards** ("Must include unit tests using Jest + Testing Library")
- **Design philosophies** ("Favor composition over inheritance")
- **Stack-specific expertise** ("When using React, always wrap forms with react-hook-form")
- **Code review heuristics**
- **Security concerns for this area**
- **Architecture principles**
- **Taste** (naming conventions, file organization, code style)

An agent.md file must have `type: agent` in the YAML front matter, otherwise it follows the same structure as kits and walkthroughs.

## YAML Front Matter Structure

The YAML front matter must include:

- `id`: Unique identifier (kebab-case, e.g., 'rust-expert')
- `alias`: Display name (e.g., 'Rust Expert Developer')
- `type`: Must be 'agent'
- `version`: Version number (e.g., 1)
- `description`: **REQUIRED - Description of the agent's expertise** (e.g., 'Expert in Rust systems programming with focus on memory safety and performance'). Must be a clear, concise sentence describing what this agent specializes in and provides an overview at a glance.
- `tags`: **REQUIRED - Array of 1-3 relevant tags** (e.g., ['rust', 'systems-programming', 'memory-safety']). NEVER leave empty - tags are used for filtering and categorization in the UI.
- `capabilities`: **REQUIRED - Array of exactly 3 bullet points** describing the agent's key abilities. Each capability should be a clear, concise statement of what the agent can do (e.g., ['Full access to local project files', 'Can run MCP tool calls', 'Ideal for: systems kits, performance optimization, low-level programming']). MUST have exactly 3 items.
- `executionNotes`: (Optional) Notes about how this agent executes tasks

**CRITICAL**:
- The `tags`, `description`, and `capabilities` fields MUST ALWAYS be filled out with meaningful content. NEVER generate an agent with empty tags, description, or capabilities.
- The `capabilities` field MUST contain exactly 3 bullet points that clearly describe the agent's key abilities.
- These fields are essential for the UI to function properly - tags for filtering, description for overview, capabilities for understanding what the agent does.

