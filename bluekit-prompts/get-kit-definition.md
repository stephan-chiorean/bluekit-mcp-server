A **Kit** is a single, self-contained markdown instruction file that represents one atomic agent execution.

A Kit:

1. **Defines one coherent unit of work**: Can be a component, flow, feature, or entire app

2. **Contains complete instructions + code + structure**: Everything needed for that unit in one file

3. **Is technology-agnostic**: Works across any technology stack

4. **Is modular, reusable, and parameterizable**: Uses tokens for customization and adaptation

5. **Is AI-agent ready**: 1 kit → 1 agent context → 1 execution

6. **Is not tied to any project**: Tokens make it adaptable to different contexts

In short:

➡️ A Kit is the atomic instruction set for a single agent run, containing everything needed to build one modular piece of software.

## YAML Front Matter Structure

Every kit must include YAML front matter with the following fields:

- `id`: Unique identifier (kebab-case, e.g., 'react-form-component')
- `alias`: Display name (e.g., 'React Form Component')
- `type`: Must be 'kit'
- `is_base`: Boolean indicating if this is a base kit (usually false)
- `version`: Version number (e.g., 1)
- `tags`: **REQUIRED - Array of 1-3 relevant tags** (e.g., ['react', 'forms', 'typescript']). NEVER leave empty - tags are used for filtering and categorization in the UI.
- `description`: **REQUIRED - Brief description of what this kit does** (e.g., 'A reusable form component with validation and error handling'). Must be a clear, concise sentence that provides an overview at a glance.

**CRITICAL**: The `tags` and `description` fields MUST ALWAYS be filled out with meaningful content. NEVER generate a kit with empty tags or description. These fields are essential for the UI to function properly.

