A **walkthrough** is a markdown document that guides builders through understanding code, systems, or implementations. Think of it as a code notebook—capturing knowledge about how something works in a way that's practical and actionable.

## Core Principles

1. **Focused**: Addresses a specific topic, system, or question
2. **Clear progression**: Information flows logically from context to details
3. **Practical**: Written for builders who need to understand and work with code
4. **Appropriate depth**: Matches the complexity and format to the use case

## Common Use Cases

- **Understanding existing code**: How a system, feature, or module works
- **Code reviews**: What changed, why it matters, what to watch for
- **Architecture documentation**: How components connect and interact
- **Implementation guides**: How something was built and design decisions made
- **Quick references**: Key patterns, APIs, or common operations

## Structure Guidelines

The structure should match the need:

- **Simple**: Direct, concise explanations for straightforward topics
- **Moderate**: Organized sections with code examples and explanations
- **Comprehensive**: Deep dives with multiple sections, flow descriptions, and detailed analysis

## What to Include

- Clear explanations of what code does and why
- Code examples with context
- How components or systems interact
- Design decisions and trade-offs
- Dependencies and relationships
- Data flow and execution paths
- Practical insights for working with the code

## What to Avoid

- Generic tutorials disconnected from actual code
- Exercises or learning checkpoints (this is documentation, not coursework)
- Overly academic explanations without practical context
- Unnecessary complexity when simplicity serves better

## AI-Agent Ready

Walkthroughs should be useful for AI coding assistants—clear enough that an agent can read the walkthrough and understand how to work with the code.

**In short**: A walkthrough is a practical code notebook that helps builders understand how something works, with structure and depth tailored to the specific need.

## YAML Front Matter Structure

Every walkthrough must include YAML front matter with the following fields:

- `id`: Unique identifier (kebab-case, e.g., 'authentication-flow')
- `alias`: Display name (e.g., 'Authentication Flow')
- `type`: Must be 'walkthrough'
- `is_base`: Boolean indicating if this is a base walkthrough (usually false)
- `version`: Version number (e.g., 1)
- `tags`: **REQUIRED - Array of 1-3 relevant tags** (e.g., ['authentication', 'security', 'react']). NEVER leave empty - tags are used for filtering and categorization in the UI.
- `description`: **REQUIRED - Brief description of what this walkthrough covers** (e.g., 'Understanding the OAuth2 authentication flow implementation with token refresh'). Must be a clear, concise sentence that provides an overview at a glance.
- `complexity`: Complexity level ('simple', 'moderate', or 'comprehensive')
- `format`: Format type ('reference', 'guide', 'review', 'architecture', or 'documentation')

**CRITICAL**: The `tags` and `description` fields MUST ALWAYS be filled out with meaningful content. NEVER generate a walkthrough with empty tags or description. These fields are essential for the UI to function properly.
