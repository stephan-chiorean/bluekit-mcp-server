# Clone System

The Clone system allows you to snapshot git repositories at specific commits and recreate them later. This is perfect for saving project states that you want to reuse.

## How It Works

### 1. Register a Clone (Snapshot)

When you're in a git repository and want to save its current state:

```typescript
bluekit_clone_register({
  projectPath: '/path/to/your/project',
  name: 'BlueKit Foundation',
  description: 'Stable UI foundation with all components',
  tags: ['foundation', 'ui-components', 'react']
})
```

**What happens:**
- Detects git URL, current commit hash, branch, and tag
- Generates unique clone ID: `bluekit-foundation-20251130`
- Saves to `~/.bluekit/projectRegistry.json`
- Clone appears in your UI's Clones tab

### 2. Create Project from Clone

When you want to recreate a project from a saved clone:

```typescript
bluekit_clone_createProject({
  cloneId: 'bluekit-foundation-20251130',
  targetPath: '/path/to/new/project'
})
```

**What happens (all automatic):**
1. Clones git repository to temp directory
2. Checks out exact commit hash
3. Copies files to target location (excludes .git)
4. Cleans up temp directory
5. New project ready to use!

## Registry Format

Clones are stored in `~/.bluekit/projectRegistry.json`:

```json
{
  "clones": [
    {
      "id": "bluekit-foundation-20251130",
      "name": "BlueKit Foundation",
      "description": "Stable UI foundation with all components",
      "gitUrl": "https://github.com/you/blueKit",
      "gitCommit": "abc123def456789...",
      "gitBranch": "main",
      "gitTag": "v1.2.0",
      "tags": ["foundation", "ui-components", "react"],
      "createdAt": "2025-11-30T10:30:00Z"
    }
  ]
}
```

## UI Integration

### Clones Tab (blueKit Frontend)

Your Rust backend reads `projectRegistry.json` and displays clones as cards:

```
📦 BlueKit Foundation
Stable UI foundation with all components

📍 github.com/you/blueKit @ abc123d
🏷️  foundation, ui-components, react
📅 Nov 30, 2025

[Create New Project] [Edit] [Delete]
```

### User Flow

**Chat Interface:**
1. User: "Clone this project as BlueKit Foundation"
2. MCP: Calls `bluekit_clone_register`
3. Clone saved to registry
4. User sees it in Clones tab

**UI Button:**
1. User clicks "Create New Project"
2. File dialog opens
3. Rust IPC calls `create_project_from_clone`
4. Project created!

## Two Paths, Same Data

**Path 1 (Chat → MCP):**
```
User chat → bluekit_clone_register → projectRegistry.json
```

**Path 2 (UI → Rust IPC):**
```
User button → Rust IPC → projectRegistry.json
```

Both write to the same registry, both read by UI!

## Examples

### Example 1: Save Current State

```bash
# In chat
"Clone this project as BlueKit Foundation with tags foundation and ui-components"
```

MCP calls:
```typescript
bluekit_clone_register({
  projectPath: process.cwd(),
  name: 'BlueKit Foundation',
  tags: ['foundation', 'ui-components']
})
```

### Example 2: Create New Project

```bash
# In chat
"Create a new project from the bluekit-foundation clone at /Users/me/newApp"
```

MCP calls:
```typescript
bluekit_clone_createProject({
  cloneId: 'bluekit-foundation-20251130',
  targetPath: '/Users/me/newApp'
})
```

### Example 3: Multiple Clones for Versions

```typescript
// Save v1.0.0
bluekit_clone_register({
  projectPath: '/path/to/blueKit',
  name: 'BlueKit v1.0.0',
  tags: ['release', 'stable']
})

// Save v2.0.0 (later)
bluekit_clone_register({
  projectPath: '/path/to/blueKit',
  name: 'BlueKit v2.0.0',
  tags: ['release', 'stable', 'major-update']
})

// Can create projects from either version!
```

## Benefits

✅ **Git-based** - Uses commit hashes, perfectly reproducible
✅ **Lightweight** - Registry is just JSON, no bundled code
✅ **Portable** - Share registry, users can clone from git
✅ **Version control** - Save multiple snapshots of same project
✅ **UI-friendly** - Registry designed for easy UI rendering
✅ **Dual interface** - Works from chat OR UI buttons

## Technical Details

### Git Operations

All git operations happen invisibly:
```bash
# Register (gets info)
git config --get remote.origin.url
git rev-parse HEAD
git rev-parse --abbrev-ref HEAD
git describe --exact-match --tags HEAD

# Create project (clones)
git clone <url> <temp>
git checkout <commit>
# Copy files
# Clean up temp
```

### Temp Directory

Temporary clones stored in:
```
~/.bluekit/tmp/git-sources/clone-<timestamp>/
```

Auto-cleaned after copy completes.

### File Exclusions

When copying, automatically excludes:
- `.git/` directory

This gives you a clean project without git history.

## Future Enhancements

- **Private repos**: Auth support for private git repositories
- **Partial clones**: Clone specific subdirectories only
- **Clone updates**: Update existing clone to new commit
- **Clone diff**: Compare two clones to see changes
- **Clone templates**: Extract patterns from clones for reuse
