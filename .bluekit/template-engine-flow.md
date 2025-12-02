# Blueprint Template Engine Flow

## Executive Summary

This document outlines how the template engine should work within the blueprint execution workflow, bridging the gap between "documentation artifacts" (current state) and "executable recipes" (vision state).

**Current Reality:** Blueprints are human-readable markdown instructions with metadata
**Target State:** Blueprints are executable recipes that generate working applications via parameterized templates

---

## The Complete Blueprint Execution Flow

### Phase 1: Blueprint Creation (What Exists Today)

```
User/AI creates blueprint
    ↓
bluekit_blueprint_generateBlueprint()
    ↓
Creates folder structure:
  .bluekit/blueprints/{blueprint-id}/
    ├── blueprint.json          (metadata, layers, tasks)
    ├── task-1.md              (human instructions)
    ├── task-2.md
    └── ...
```

**Gap:** No template files, no file operations defined

### Phase 2: Blueprint Execution (What Should Exist)

```
User selects blueprint + provides config
    ↓
bluekit_blueprint_executeBlueprint(blueprintId, targetPath, config)
    ↓
For each layer (sequential):
    For each task in layer (parallel):
        1. Load task file
        2. Parse file operations
        3. Execute operations via FileOperationsExecutor
            - COPY: preserve files verbatim
            - TEMPLATE: inject variables, render handlebars
            - GENERATE: AI-powered code generation
    ↓
Post-generation hooks (npm install, git init)
    ↓
Register as clone
    ↓
Working application ready
```

---

## Data Model Changes Required

### Current Blueprint Task Structure

```json
{
  "id": "task-1",
  "taskFile": "project-setup.md",
  "description": "Initialize Tauri project"
}
```

### Enhanced Blueprint Task Structure

```json
{
  "id": "task-1",
  "taskFile": "project-setup.md",
  "description": "Initialize Tauri project",
  "operations": [
    {
      "type": "copy",
      "source": "{{sourceReference}}/package.json",
      "destination": "package.json"
    },
    {
      "type": "template",
      "source": "templates/tauri.conf.json.hbs",
      "destination": "src-tauri/tauri.conf.json",
      "variables": ["appName", "appIdentifier", "windowTitle"]
    },
    {
      "type": "template",
      "source": "templates/App.tsx.hbs",
      "destination": "src/App.tsx",
      "variables": ["appName", "theme"]
    },
    {
      "type": "generate",
      "destination": "src/services/api.ts",
      "prompt": "Generate API service based on config.endpoints"
    }
  ]
}
```

### Enhanced Blueprint Folder Structure

```
.bluekit/blueprints/{blueprint-id}/
  ├── blueprint.json              (metadata with operations)
  ├── templates/                  (NEW)
  │   ├── App.tsx.hbs            (handlebars templates)
  │   ├── tauri.conf.json.hbs
  │   ├── package.json.hbs
  │   └── components/
  │       └── {{contentType}}Tab.tsx.hbs
  ├── source/                     (NEW - optional)
  │   ├── public/                (files to copy verbatim)
  │   ├── assets/
  │   └── lib/
  ├── tasks/                      (RENAMED from root)
  │   ├── project-setup.md       (human-readable context)
  │   ├── backend-foundation.md
  │   └── ...
  └── config.schema.json          (validation schema)
```

---

## Template Engine Integration Points

### 1. Variable Sources

The template engine receives variables from multiple sources:

```typescript
interface ExecutionContext {
  // User-provided configuration
  config: {
    app: {
      name: "MyPodcastApp",
      identifier: "com.example.podcast",
      displayName: "My Podcast Library"
    },
    contentTypes: [
      {
        name: "podcast",
        plural: "podcasts",
        icon: "LuMic",
        fields: [...]
      }
    ],
    theme: {
      primaryColor: "purple",
      accentColor: "orange"
    }
  },

  // Blueprint metadata
  blueprint: {
    id: "content-library-app",
    name: "Content Library Application",
    version: 2
  },

  // System-generated values
  generated: {
    timestamp: "2025-12-01T10:30:00Z",
    sourceReference: "/path/to/source"
  }
}
```

### 2. Template Compilation Flow

```
File Operation (type: template)
    ↓
FileOperationsExecutor.executeTemplate()
    ↓
1. Read template file from blueprint folder
   Example: templates/App.tsx.hbs
    ↓
2. Merge all variable sources into single context
   const context = { ...config, ...blueprint, ...generated }
    ↓
3. TemplateEngine.compile(template, context)
    ↓
4. Handlebars processes:
   - Variable substitution: {{appName}}
   - Helpers: {{pascalCase contentType.name}}
   - Conditionals: {{#if theme.darkMode}}...{{/if}}
   - Iterations: {{#each contentTypes}}...{{/each}}
    ↓
5. Write compiled output to destination path
   (destination path also templated: "{{contentType}}Tab.tsx")
```

### 3. Path Template Examples

```handlebars
// Input operation:
{
  "type": "template",
  "source": "templates/{{contentType}}Tab.tsx.hbs",
  "destination": "src/components/{{pascalCase contentType.name}}Tab.tsx"
}

// With config: { contentType: { name: "podcast" } }

// Resolves to:
source:      templates/podcastTab.tsx.hbs
destination: src/components/PodcastTab.tsx
```

### 4. Content Iteration Pattern

When `variables` array includes `contentType`:

```json
{
  "type": "template",
  "source": "templates/ContentTab.tsx.hbs",
  "destination": "src/components/{{pascalCase contentType.name}}Tab.tsx",
  "variables": ["contentType"]
}
```

The executor automatically iterates:

```typescript
if (operation.variables.includes('contentType') && config.contentTypes) {
  for (const contentType of config.contentTypes) {
    // Generate one file per content type
    await generateTemplateFile(operation, { ...config, contentType }, ...)
  }
}
```

Result:
- `src/components/PodcastTab.tsx`
- `src/components/BookTab.tsx`
- `src/components/VideoTab.tsx`

---

## Example Template Files

### Template: `templates/App.tsx.hbs`

```typescript
import { ChakraProvider, Box, Heading } from '@chakra-ui/react';
import { useState } from 'react';
{{#each contentTypes}}
import {{pascalCase name}}Tab from './components/{{pascalCase name}}Tab';
{{/each}}

function App() {
  return (
    <ChakraProvider>
      <Box p={4}>
        <Heading>{{config.app.displayName}}</Heading>
        {{#each contentTypes}}
        <{{pascalCase name}}Tab />
        {{/each}}
      </Box>
    </ChakraProvider>
  );
}

export default App;
```

### Template: `templates/tauri.conf.json.hbs`

```json
{
  "package": {
    "productName": "{{config.app.displayName}}",
    "version": "0.1.0"
  },
  "tauri": {
    "bundle": {
      "identifier": "{{config.app.identifier}}",
      "icon": [
        "icons/32x32.png",
        "icons/128x128.png"
      ]
    },
    "windows": [
      {
        "title": "{{config.app.displayName}}",
        "width": {{#if config.ui.defaultWidth}}{{config.ui.defaultWidth}}{{else}}1200{{/if}},
        "height": {{#if config.ui.defaultHeight}}{{config.ui.defaultHeight}}{{else}}800{{/if}}
      }
    ]
  }
}
```

### Template: `templates/{{contentType}}Tab.tsx.hbs`

```typescript
import { Box, Card, Heading, VStack } from '@chakra-ui/react';
import { {{pascalCase contentType.icon}} } from 'react-icons/lu';

export default function {{pascalCase contentType.name}}Tab() {
  return (
    <Card.Root>
      <Card.Header>
        <Heading size="md">
          <{{pascalCase contentType.icon}} /> {{capitalize contentType.plural}}
        </Heading>
      </Card.Header>
      <Card.Body>
        <VStack align="stretch" gap={4}>
          {/* {{pascalCase contentType.name}} list will go here */}
          {{#if contentType.hasViewer}}
          {/* Viewer component */}
          {{/if}}
          {{#if contentType.hasEditor}}
          {/* Editor component */}
          {{/if}}
        </VStack>
      </Card.Body>
    </Card.Root>
  );
}
```

---

## Configuration Schema Example

### `config.schema.json`

```json
{
  "type": "object",
  "properties": {
    "app": {
      "type": "object",
      "properties": {
        "name": { "type": "string", "description": "Internal app name (kebab-case)" },
        "displayName": { "type": "string", "description": "User-facing app name" },
        "identifier": { "type": "string", "description": "Reverse domain (com.example.app)" }
      },
      "required": ["name", "displayName", "identifier"]
    },
    "contentTypes": {
      "type": "array",
      "description": "Content types to generate tabs/CRUD for",
      "items": {
        "type": "object",
        "properties": {
          "name": { "type": "string" },
          "plural": { "type": "string" },
          "icon": { "type": "string", "description": "React icon component name" },
          "fields": {
            "type": "array",
            "items": {
              "type": "object",
              "properties": {
                "name": { "type": "string" },
                "type": { "type": "string", "enum": ["string", "number", "boolean", "date"] },
                "required": { "type": "boolean" }
              }
            }
          },
          "hasViewer": { "type": "boolean" },
          "hasEditor": { "type": "boolean" }
        },
        "required": ["name", "plural"]
      }
    },
    "theme": {
      "type": "object",
      "properties": {
        "primaryColor": { "type": "string" },
        "accentColor": { "type": "string" },
        "darkMode": { "type": "boolean" }
      }
    }
  },
  "required": ["app", "contentTypes"]
}
```

---

## UI Interaction Flow

### In BlueprintsTabContent.tsx

**Current:** "Add to Project" just copies the blueprint folder

**Enhanced:**

```typescript
const handleExecuteBlueprint = async (blueprint: Blueprint) => {
  // 1. Show config form modal
  const config = await showConfigModal(blueprint.metadata.configSchema);

  // 2. Select target directory
  const targetPath = await open({ directory: true });

  // 3. Execute blueprint with config
  await invokeExecuteBlueprint(blueprint.metadata.id, targetPath, config);

  // 4. Show success + offer to open in file manager
  toaster.create({
    type: 'success',
    title: 'Application Generated!',
    description: `${config.app.displayName} created at ${targetPath}`
  });
};
```

### Config Form Modal (New Component)

```typescript
interface ConfigFormModalProps {
  schema: JSONSchema;
  onSubmit: (config: AppConfig) => void;
}

function ConfigFormModal({ schema, onSubmit }: ConfigFormModalProps) {
  // Dynamically generate form fields from schema
  // - Text inputs for strings
  // - Number inputs for numbers
  // - Checkboxes for booleans
  // - Array editors for contentTypes

  return (
    <DialogRoot open={isOpen}>
      <DialogContent>
        <DialogHeader>Configure Your Application</DialogHeader>
        <DialogBody>
          <VStack gap={4}>
            <Field label="App Name">
              <Input value={config.app.name} onChange={...} />
            </Field>

            <Field label="Content Types">
              <ArrayEditor
                value={config.contentTypes}
                onChange={...}
                schema={schema.properties.contentTypes}
              />
            </Field>

            {/* ... more fields */}
          </VStack>
        </DialogBody>
        <DialogFooter>
          <Button onClick={() => onSubmit(config)}>
            Generate Application
          </Button>
        </DialogFooter>
      </DialogContent>
    </DialogRoot>
  );
}
```

---

## Implementation Checklist

### Backend (blueKitMcp)

- [ ] **Data Model**
  - [ ] Add `operations` field to `BlueprintTask` interface
  - [ ] Support operations in `bluekit_blueprint_generateBlueprint`
  - [ ] Validate operations during blueprint generation

- [ ] **Blueprint Structure**
  - [ ] Create `templates/` folder during generation
  - [ ] Create `source/` folder for preserved files
  - [ ] Move task markdown files to `tasks/` subfolder
  - [ ] Include `config.schema.json` in blueprint folder

- [ ] **Execution Tool**
  - [ ] Implement `bluekit_blueprint_executeBlueprint` tool
  - [ ] Layer-by-layer sequential execution
  - [ ] Task-level parallel execution within layers
  - [ ] Error handling and rollback

- [ ] **Operation Execution**
  - [ ] Wire `FileOperationsExecutor` to execution tool
  - [ ] Implement context merging (config + blueprint + generated)
  - [ ] Test COPY operations
  - [ ] Test TEMPLATE operations with variable substitution
  - [ ] Test path templating (`{{contentType}}Tab.tsx`)
  - [ ] Test content iteration (one file per contentType)

- [ ] **Post-Generation**
  - [ ] Run npm install (optional)
  - [ ] Git init (optional)
  - [ ] Create clone registry entry
  - [ ] Return execution summary

### Frontend (blueKit)

- [ ] **Config Modal**
  - [ ] Create `ConfigFormModal.tsx` component
  - [ ] JSON Schema → Form renderer
  - [ ] Array field editors (for contentTypes)
  - [ ] Validation feedback

- [ ] **Blueprint Actions**
  - [ ] Add "Execute Blueprint" button
  - [ ] Replace "Add to Project" or add alongside
  - [ ] Show config modal before execution
  - [ ] Progress indicator during execution

- [ ] **IPC Commands**
  - [ ] Add `invokeExecuteBlueprint(blueprintId, targetPath, config)`
  - [ ] Add execution progress events (optional)
  - [ ] Add execution error handling

### Testing

- [ ] **Unit Tests**
  - [ ] TemplateEngine with all helpers
  - [ ] FileOperationsExecutor for each operation type
  - [ ] Path template compilation
  - [ ] Content iteration logic

- [ ] **Integration Tests**
  - [ ] End-to-end blueprint execution
  - [ ] Multi-layer, multi-task blueprints
  - [ ] Config validation
  - [ ] Error scenarios (missing templates, invalid config)

- [ ] **Example Blueprints**
  - [ ] Simple single-page app (1 layer)
  - [ ] Content library app (multi-layer, contentTypes iteration)
  - [ ] Full Tauri + React app (current react-tauri-rust-app-v2)

---

## Migration Path for Existing Blueprints

### Option 1: Manual Enhancement
1. User adds `operations` to existing blueprint.json
2. User creates `templates/` folder with handlebars files
3. User optionally adds `source/` folder for preserved files

### Option 2: Extraction Tool (Future)
```typescript
bluekit_blueprint_enhanceWithTemplates(blueprintId, sourcePath)
// Analyzes source code, generates templates, adds operations
```

---

## Success Metrics

**Before (Current State):**
- User clicks "Add to Project"
- Blueprint folder copied
- User manually reads 6 markdown files
- User manually implements ~50 steps
- Time to working app: 2-4 hours

**After (Target State):**
- User clicks "Execute Blueprint"
- User fills config form (5 fields)
- Clicks "Generate"
- Execution completes in 30 seconds
- Time to working app: 2 minutes

**Value Unlocked:**
- 95% reduction in manual implementation time
- Guaranteed consistency (no missed steps)
- Parameterized variation (same blueprint → different apps)
- Iterative refinement (clone → blueprint → clone loop)

---

## Open Questions

1. **Should operations be in blueprint.json or task markdown files?**
   - Proposal: blueprint.json (machine-readable)
   - Task markdown remains human context

2. **How to handle AI GENERATE operations?**
   - MVP: Create TODO placeholder
   - Future: Call LLM with context from config + existing files

3. **Should we version blueprint structure?**
   - Add `blueprintVersion` field to detect old vs. new format
   - Support both during transition period

4. **How to preview what will be generated?**
   - Add `bluekit_blueprint_preview(blueprintId, config)` tool
   - Returns list of files that would be created

5. **Should template rendering be idempotent?**
   - Important for regeneration after config changes
   - Proposal: Always overwrite, but warn about local modifications

---

## Next Actions

1. **Validate Approach** - Review this flow with team/stakeholders
2. **Create Example Blueprint** - Build one complete blueprint with templates
3. **Implement Execution Tool** - Backend MCP tool first
4. **Test Template Rendering** - Verify all handlebars helpers work
5. **Build Config UI** - Frontend modal for config input
6. **End-to-End Test** - Generate working app from blueprint
7. **Document for Users** - Guide on creating template-enabled blueprints
