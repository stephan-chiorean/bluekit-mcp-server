# Clone System - Retrieval Instructions

This document describes how to retrieve and work with clones in the BlueKit system.

## Storage Architecture

Clones are stored **per-project** in each project's `.bluekit` directory. The main registry only contains project metadata.

```
~/.bluekit/projectRegistry.json          (project metadata only)
├── Project 1 → /path/to/project1/.bluekit/clones.json
├── Project 2 → /path/to/project2/.bluekit/clones.json
└── Project 3 → /path/to/project3/.bluekit/clones.json
```

## File Locations

### 1. Project Registry
**Location:** `~/.bluekit/projectRegistry.json`

**Structure:**
```json
[
  {
    "id": "1763859627143",
    "title": "blueKit",
    "description": "",
    "path": "/Users/stephanchiorean/Documents/projects/blueKitApps/blueKit"
  },
  {
    "id": "1764426255926",
    "title": "learnhub",
    "description": "",
    "path": "/Users/stephanchiorean/Documents/projects/learnhub"
  }
]
```

**Fields:**
- `id`: Unique project identifier (timestamp string)
- `title`: Project display name
- `description`: Optional project description
- `path`: Absolute path to the project directory

### 2. Per-Project Clone Files
**Location:** `{projectPath}/.bluekit/clones.json`

**Structure:**
```json
[
  {
    "id": "bluekit-foundation-20251201",
    "name": "BlueKit Foundation",
    "description": "Stable UI foundation with all components",
    "gitUrl": "https://github.com/user/blueKit.git",
    "gitCommit": "1ab1a39712c2e5c765182525ccf497b0cdddc91b",
    "gitBranch": "main",
    "gitTag": "v1.2.0",
    "tags": ["foundation", "ui-components", "react"],
    "createdAt": "2025-12-01T10:30:00.000Z",
    "metadata": {}
  }
]
```

## Clone Metadata Shape

### CloneMetadata Interface

```typescript
interface CloneMetadata {
  id: string;                    // Unique clone ID (format: slugified-name-YYYYMMDD)
  name: string;                   // Display name (e.g., "BlueKit Foundation")
  description: string;            // Description of what this clone represents
  gitUrl: string;                 // Git repository URL
  gitCommit: string;              // Full commit hash (40 chars)
  gitBranch?: string;             // Branch name (if not detached HEAD)
  gitTag?: string;                // Git tag (if HEAD is on a tag)
  tags: string[];                  // Array of tags for categorization
  createdAt: string;              // ISO 8601 timestamp
  metadata?: Record<string, any>; // Optional additional metadata
}
```

### Field Descriptions

- **id**: Auto-generated from name and date (e.g., `"bluekit-foundation-20251201"`)
- **name**: User-provided display name
- **description**: User-provided description
- **gitUrl**: Remote origin URL from `git config --get remote.origin.url`
- **gitCommit**: Full SHA-1 commit hash from `git rev-parse HEAD`
- **gitBranch**: Current branch name (undefined if detached HEAD)
- **gitTag**: Tag name if HEAD is exactly on a tag (undefined otherwise)
- **tags**: Array of user-provided tags for filtering/searching
- **createdAt**: ISO 8601 timestamp when clone was registered
- **metadata**: Optional object for future extensibility

## Retrieval Methods

### Method 1: Get All Clones from All Projects

```typescript
// 1. Read project registry
const registryPath = path.join(os.homedir(), '.bluekit', 'projectRegistry.json');
const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

// 2. Iterate through projects and read their clone files
const allClones: CloneMetadata[] = [];

for (const project of registry) {
  const clonesPath = path.join(project.path, '.bluekit', 'clones.json');
  
  if (fs.existsSync(clonesPath)) {
    const clones = JSON.parse(fs.readFileSync(clonesPath, 'utf8'));
    allClones.push(...clones);
  }
}
```

### Method 2: Get Clones for a Specific Project

```typescript
const projectPath = '/path/to/project';
const clonesPath = path.join(projectPath, '.bluekit', 'clones.json');

if (fs.existsSync(clonesPath)) {
  const clones: CloneMetadata[] = JSON.parse(fs.readFileSync(clonesPath, 'utf8'));
  // Use clones array
}
```

### Method 3: Find Clone by ID

```typescript
function findCloneById(cloneId: string): CloneMetadata | undefined {
  const registryPath = path.join(os.homedir(), '.bluekit', 'projectRegistry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));

  for (const project of registry) {
    const clonesPath = path.join(project.path, '.bluekit', 'clones.json');
    
    if (fs.existsSync(clonesPath)) {
      const clones: CloneMetadata[] = JSON.parse(fs.readFileSync(clonesPath, 'utf8'));
      const clone = clones.find(c => c.id === cloneId);
      
      if (clone) {
        return clone;
      }
    }
  }
  
  return undefined;
}
```

### Method 4: Search Clones by Tags

```typescript
function findClonesByTag(tag: string): CloneMetadata[] {
  const registryPath = path.join(os.homedir(), '.bluekit', 'projectRegistry.json');
  const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
  const matchingClones: CloneMetadata[] = [];

  for (const project of registry) {
    const clonesPath = path.join(project.path, '.bluekit', 'clones.json');
    
    if (fs.existsSync(clonesPath)) {
      const clones: CloneMetadata[] = JSON.parse(fs.readFileSync(clonesPath, 'utf8'));
      const matches = clones.filter(c => c.tags.includes(tag));
      matchingClones.push(...matches);
    }
  }
  
  return matchingClones;
}
```

## Path Resolution

**Important:** Always use absolute paths when working with clones.

- Project paths in registry are stored as absolute paths
- Clone file paths are relative to project root: `{projectPath}/.bluekit/clones.json`
- Use `path.resolve()` to normalize paths before comparison

## Error Handling

### File Not Found
- If `projectRegistry.json` doesn't exist → return empty array
- If a project's `clones.json` doesn't exist → skip that project (no clones yet)

### Invalid JSON
- If JSON parsing fails → log error and return empty array for that file
- Don't fail entire operation if one project's file is corrupted

### Missing Project Directory
- If a project's `path` no longer exists → skip that project
- Consider cleaning up registry entries for deleted projects

## Example: Complete Retrieval Function

```typescript
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

interface CloneMetadata {
  id: string;
  name: string;
  description: string;
  gitUrl: string;
  gitCommit: string;
  gitBranch?: string;
  gitTag?: string;
  tags: string[];
  createdAt: string;
  metadata?: Record<string, any>;
}

function getAllClones(): CloneMetadata[] {
  const registryPath = path.join(os.homedir(), '.bluekit', 'projectRegistry.json');
  
  if (!fs.existsSync(registryPath)) {
    return [];
  }

  try {
    const registry = JSON.parse(fs.readFileSync(registryPath, 'utf8'));
    
    if (!Array.isArray(registry)) {
      return [];
    }

    const allClones: CloneMetadata[] = [];

    for (const project of registry) {
      if (!project.path || typeof project.path !== 'string') {
        continue;
      }

      const projectPath = path.resolve(project.path);
      const clonesPath = path.join(projectPath, '.bluekit', 'clones.json');

      if (!fs.existsSync(projectPath) || !fs.existsSync(clonesPath)) {
        continue;
      }

      try {
        const clones = JSON.parse(fs.readFileSync(clonesPath, 'utf8'));
        
        if (Array.isArray(clones)) {
          allClones.push(...clones);
        }
      } catch (error) {
        console.error(`Failed to read clones from ${clonesPath}:`, error);
        // Continue with other projects
      }
    }

    return allClones;
  } catch (error) {
    console.error('Failed to read project registry:', error);
    return [];
  }
}
```

## UI Integration Tips

1. **Display clones with project context:**
   - When showing a clone, include the project it came from
   - Use `project.title` or `project.path` for context

2. **Grouping options:**
   - Group by project
   - Group by tags
   - Group by creation date

3. **Filtering:**
   - Filter by tags
   - Filter by project
   - Search by name/description

4. **Performance:**
   - Cache clone data in memory after first load
   - Watch for file changes if you need real-time updates
   - Consider lazy-loading clones per project

## Notes

- Clones are stored per-project to avoid conflicts and improve performance
- The main registry is lightweight and only contains project metadata
- Each project manages its own clones independently
- Clone IDs are globally unique (format: `slugified-name-YYYYMMDD`)
- When searching, you may find multiple clones with similar names but different dates


