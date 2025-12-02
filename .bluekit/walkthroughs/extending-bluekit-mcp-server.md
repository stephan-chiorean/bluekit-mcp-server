---
id: extending-bluekit-mcp-server
alias: Extending BlueKit MCP Server
type: walkthrough
is_base: false
version: 1
tags:
  - extension
  - architecture
  - enhancement
description: Comprehensive guide to extending the BlueKit MCP Server with better features, improved architecture, and missing implementations
complexity: comprehensive
format: guide
---
# Extending BlueKit MCP Server

## Overview

This walkthrough provides a comprehensive guide for extending the BlueKit MCP Server with enhanced features, architectural improvements, and missing implementations. It covers both immediate improvements and long-term architectural enhancements.

## Current State Assessment

The BlueKit MCP Server has a solid foundation with:
- ✅ Clean layered architecture (MCP → Tools → Utilities)
- ✅ Extensible tool set pattern via `BaseToolSet`
- ✅ Resource system for prompt definitions
- ✅ Template engine infrastructure
- ✅ Blueprint and clone management

However, several areas need enhancement:
- ⚠️ Git source references (stubbed, not implemented)
- ⚠️ AI-powered code generation (placeholder only)
- ⚠️ Missing bidirectional clone ↔ blueprint workflows
- ⚠️ Limited error handling and validation
- ⚠️ No caching or performance optimizations
- ⚠️ Minimal observability and logging

## Extension Categories

### 1. Missing Feature Implementations

#### 1.1 Git Source Reference Support

**Current State:**
The `SourceResolver.resolveGit()` method throws an error indicating git support is not implemented.

**Location:** `src/tools/SourceResolver.ts` (lines 76-96)

**Implementation Plan:**

```typescript
// Add dependencies to package.json
{
  "dependencies": {
    "simple-git": "^3.0.0"  // Or use child_process for git commands
  }
}

// Enhanced resolveGit implementation
private async resolveGit(
  gitUrl: string, 
  gitRef: string | undefined, 
  targetPath: string
): Promise<string> {
  const cloneDir = path.join(
    targetPath, 
    '.bluekit', 
    'tmp', 
    'git-sources', 
    this.gitUrlToFolderName(gitUrl)
  );

  // Check if already cloned
  if (fs.existsSync(cloneDir)) {
    if (gitRef) {
      // Checkout specific ref
      const git = simpleGit(cloneDir);
      await git.checkout(gitRef);
    }
    return cloneDir;
  }

  // Clone repository
  const git = simpleGit();
  await git.clone(gitUrl, cloneDir);
  
  // Checkout specific ref if provided
  if (gitRef) {
    await git.cwd(cloneDir).checkout(gitRef);
  }

  return cloneDir;
}
```

**Additional Enhancements:**
- Cache management (cleanup old clones)
- Authentication support (SSH keys, tokens)
- Shallow clone option for large repos
- Progress reporting for long operations

#### 1.2 AI-Powered Code Generation

**Current State:**
`FileOperations.executeGenerate()` creates placeholder files with TODO comments.

**Location:** `src/tools/FileOperations.ts` (lines 189-210)

**Implementation Approaches:**

**Option A: MCP Tool Integration**
```typescript
private async executeGenerate(
  operation: FileOperation,
  config: AppConfig,
  targetPath: string
): Promise<void> {
  // Use MCP client to call AI generation tools
  const mcpClient = new MCPClient();
  
  const prompt = this.buildGenerationPrompt(operation, config);
  const generatedCode = await mcpClient.callTool('ai_generateCode', {
    prompt,
    language: this.detectLanguage(operation.destination),
    context: config
  });
  
  const resolvedDest = this.resolvePath(operation.destination, config);
  const fullDest = path.join(targetPath, resolvedDest);
  
  fs.writeFileSync(fullDest, generatedCode, 'utf-8');
}
```

**Option B: Pattern-Based Generation**
```typescript
private async executeGenerate(
  operation: FileOperation,
  config: AppConfig,
  targetPath: string
): Promise<void> {
  // Load template patterns from source
  const patterns = await this.loadPatterns(operation.source);
  
  // Apply patterns with config variables
  const generatedCode = this.templateEngine.compile(patterns, config);
  
  // Write generated file
  const resolvedDest = this.resolvePath(operation.destination, config);
  const fullDest = path.join(targetPath, resolvedDest);
  fs.writeFileSync(fullDest, generatedCode, 'utf-8');
}
```

**Option C: Hybrid Approach**
- Use pattern-based for common structures
- Fall back to AI for complex/custom requirements
- Cache generated patterns for reuse

#### 1.3 Blueprint Extraction from Clones

**Current State:**
No tool exists to extract blueprints from existing clone projects.

**New Tool Implementation:**

```typescript
// Add to BlueprintTools
{
  name: 'bluekit_blueprint_extractFromClone',
  description: 'Analyze a clone project and extract a blueprint structure',
  inputSchema: {
    type: 'object',
    properties: {
      clonePath: { type: 'string' },
      blueprintId: { type: 'string' },
      analysisDepth: { 
        type: 'string',
        enum: ['shallow', 'medium', 'deep']
      }
    },
    required: ['clonePath', 'blueprintId']
  }
}

// Implementation
private handleExtractFromClone(params: Record<string, unknown>) {
  const clonePath = params.clonePath as string;
  const blueprintId = params.blueprintId as string;
  
  // 1. Analyze project structure
  const structure = this.analyzeProjectStructure(clonePath);
  
  // 2. Detect layers (by directory structure, dependencies, etc.)
  const layers = this.detectLayers(structure);
  
  // 3. Identify tasks (by files, scripts, configurations)
  const tasks = this.identifyTasks(structure, layers);
  
  // 4. Extract configuration patterns
  const configSchema = this.extractConfigSchema(structure);
  
  // 5. Generate blueprint JSON
  const blueprint = {
    id: blueprintId,
    name: this.inferName(structure),
    version: 1,
    description: this.inferDescription(structure),
    layers: layers,
    configSchema: configSchema,
    createdAt: new Date().toISOString()
  };
  
  return blueprint;
}
```

**Analysis Strategies:**
- **Directory Structure**: Identify layers by folder organization
- **Dependency Graph**: Use package.json/tsconfig.json to detect dependencies
- **File Patterns**: Recognize common patterns (components, services, etc.)
- **Git History**: Analyze commits to understand development layers

### 2. Architectural Improvements

#### 2.1 Plugin System for Tool Sets

**Current State:**
Tool sets are hardcoded in `BlueKitTools` constructor.

**Proposed Architecture:**

```typescript
// New interface
interface IToolSetPlugin {
  name: string;
  version: string;
  getToolSet(): IToolSet;
  dependencies?: string[];
}

// Enhanced BlueKitTools
export class BlueKitTools {
  private readonly plugins: Map<string, IToolSetPlugin> = new Map();
  private readonly toolSets: IToolSet[] = [];
  
  constructor(pluginPaths?: string[]) {
    // Load core tool sets
    this.loadCoreToolSets();
    
    // Load plugins if provided
    if (pluginPaths) {
      this.loadPlugins(pluginPaths);
    }
  }
  
  private loadPlugins(pluginPaths: string[]): void {
    for (const pluginPath of pluginPaths) {
      const plugin = this.loadPlugin(pluginPath);
      this.registerPlugin(plugin);
    }
  }
  
  private registerPlugin(plugin: IToolSetPlugin): void {
    // Check dependencies
    this.validateDependencies(plugin);
    
    // Register tool set
    this.plugins.set(plugin.name, plugin);
    this.toolSets.push(plugin.getToolSet());
  }
}
```

**Benefits:**
- Third-party tool sets without modifying core
- Dynamic loading of tool sets
- Version management and dependency resolution
- Easier testing and isolation

#### 2.2 Caching Layer

**Current State:**
No caching - every tool call reads from disk.

**Implementation:**

```typescript
// New CacheManager
class CacheManager {
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private ttl: number = 5 * 60 * 1000; // 5 minutes
  
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;
    
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.data as T;
  }
  
  set<T>(key: string, data: T): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now()
    });
  }
  
  invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.match(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

// Usage in BlueprintTools
private handleGetBlueprint(params: Record<string, unknown>) {
  const id = params.id as string;
  const cacheKey = `blueprint:${id}`;
  
  // Check cache
  const cached = this.cacheManager.get(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Load from disk
  const blueprint = this.loadBlueprintFromDisk(id);
  
  // Cache result
  this.cacheManager.set(cacheKey, blueprint);
  
  return blueprint;
}
```

**Cache Strategies:**
- File-based caching for large objects
- In-memory for frequently accessed data
- Cache invalidation on file changes (watch filesystem)
- TTL-based expiration

#### 2.3 Error Handling and Validation Framework

**Current State:**
Basic error handling, inconsistent validation patterns.

**Proposed Framework:**

```typescript
// Custom error types
class BlueKitError extends Error {
  constructor(
    message: string,
    public code: string,
    public context?: Record<string, any>
  ) {
    super(message);
    this.name = 'BlueKitError';
  }
}

class ValidationError extends BlueKitError {
  constructor(
    message: string,
    public field: string,
    public value: any
  ) {
    super(message, 'VALIDATION_ERROR', { field, value });
    this.name = 'ValidationError';
  }
}

// Validation decorator
function validate(schema: JSONSchema) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = function (...args: any[]) {
      const ajv = new Ajv();
      const validate = ajv.compile(schema);
      
      if (!validate(args[0])) {
        throw new ValidationError(
          'Invalid parameters',
          'parameters',
          args[0]
        );
      }
      
      return originalMethod.apply(this, args);
    };
  };
}

// Usage
class KitTools extends BaseToolSet {
  @validate({
    type: 'object',
    properties: {
      name: { type: 'string', minLength: 1 },
      content: { type: 'string' },
      projectPath: { type: 'string' }
    },
    required: ['name', 'content', 'projectPath']
  })
  private handleGenerateKit(params: Record<string, unknown>) {
    // Implementation
  }
}
```

#### 2.4 Observability and Logging

**Current State:**
Basic console.error logging.

**Enhanced Logging System:**

```typescript
// Logger interface
interface ILogger {
  debug(message: string, context?: any): void;
  info(message: string, context?: any): void;
  warn(message: string, context?: any): void;
  error(message: string, error?: Error, context?: any): void;
}

// Structured logger implementation
class StructuredLogger implements ILogger {
  constructor(
    private level: 'debug' | 'info' | 'warn' | 'error' = 'info',
    private output: NodeJS.WritableStream = process.stderr
  ) {}
  
  private log(level: string, message: string, context?: any): void {
    const entry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...context
    };
    
    this.output.write(JSON.stringify(entry) + '\n');
  }
  
  debug(message: string, context?: any): void {
    if (this.shouldLog('debug')) {
      this.log('debug', message, context);
    }
  }
  
  // ... other methods
}

// Metrics collection
class MetricsCollector {
  private metrics: Map<string, number> = new Map();
  
  increment(metric: string, value: number = 1): void {
    const current = this.metrics.get(metric) || 0;
    this.metrics.set(metric, current + value);
  }
  
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }
}

// Usage in handlers
private handleGenerateKit(params: Record<string, unknown>) {
  const startTime = Date.now();
  this.logger.info('Generating kit', { name: params.name });
  
  try {
    // ... implementation
    this.metrics.increment('kit.generated');
    this.metrics.increment('kit.duration', Date.now() - startTime);
    return result;
  } catch (error) {
    this.metrics.increment('kit.errors');
    this.logger.error('Failed to generate kit', error, { name: params.name });
    throw error;
  }
}
```

### 3. Workflow Enhancements

#### 3.1 Bidirectional Clone ↔ Blueprint Workflow

**Current Gap:**
Clones and blueprints are separate systems with no connection.

**Proposed Workflow:**

```
1. User creates clone from template
   ↓
2. User develops in clone
   ↓
3. Extract blueprint from clone (NEW)
   ↓
4. Refine blueprint parameters
   ↓
5. Generate new clone from blueprint (ENHANCED)
   ↓
6. Iterate until blueprint is solid
   ↓
7. Publish blueprint to registry
```

**Implementation:**

```typescript
// New tool: bluekit_clone_extractBlueprint
{
  name: 'bluekit_clone_extractBlueprint',
  description: 'Extract a blueprint from an existing clone project',
  // ... schema
}

// Enhanced: bluekit_blueprint_generateClone
{
  name: 'bluekit_blueprint_generateClone',
  description: 'Generate a new clone project from a blueprint',
  // ... schema
}
```

#### 3.2 Multi-Agent Workflow Support

**Current State:**
Single-agent execution model.

**Proposed Enhancement:**

```typescript
// Workflow definition
interface Workflow {
  id: string;
  name: string;
  agents: AgentAssignment[];
  dependencies: AgentDependency[];
}

interface AgentAssignment {
  agentId: string;
  layer: number;
  tasks: string[];
}

// Workflow executor
class WorkflowExecutor {
  async execute(workflow: Workflow, config: AppConfig): Promise<void> {
    // Execute agents in parallel where possible
    const layerGroups = this.groupByLayer(workflow.agents);
    
    for (const layer of layerGroups) {
      // Execute agents in parallel within layer
      await Promise.all(
        layer.map(agent => this.executeAgent(agent, config))
      );
    }
  }
}
```

#### 3.3 Blueprint Composition and Inheritance

**Current State:**
Basic `extends` support exists but limited.

**Enhancements:**

```typescript
// Enhanced blueprint metadata
interface BlueprintMetadata {
  // ... existing fields
  extends?: string | string[];  // Support multiple inheritance
  mixins?: string[];            // Reusable blueprint fragments
  overrides?: {                 // Override specific layers/tasks
    layers?: Record<string, Partial<BlueprintLayer>>;
    tasks?: Record<string, Partial<BlueprintTask>>;
  };
}

// Composition engine
class BlueprintComposer {
  compose(blueprint: BlueprintMetadata): BlueprintMetadata {
    // 1. Load parent blueprints
    const parents = this.loadParents(blueprint.extends);
    
    // 2. Load mixins
    const mixins = this.loadMixins(blueprint.mixins);
    
    // 3. Merge layers (parent → mixins → child)
    const mergedLayers = this.mergeLayers([
      ...parents.flatMap(p => p.layers),
      ...mixins.flatMap(m => m.layers),
      blueprint.layers
    ]);
    
    // 4. Apply overrides
    const finalLayers = this.applyOverrides(mergedLayers, blueprint.overrides);
    
    return {
      ...blueprint,
      layers: finalLayers
    };
  }
}
```

### 4. Developer Experience Improvements

#### 4.1 Interactive CLI Mode

**Current State:**
MCP-only interface (stdio).

**Proposed Addition:**

```typescript
// New CLI mode
class BlueKitCLI {
  async interactive(): Promise<void> {
    const questions = [
      {
        type: 'list',
        name: 'action',
        message: 'What would you like to do?',
        choices: [
          'Create a kit',
          'Generate a blueprint',
          'Execute a task',
          'List blueprints',
          // ...
        ]
      }
    ];
    
    const answers = await inquirer.prompt(questions);
    await this.handleAction(answers.action);
  }
}
```

#### 4.2 Blueprint Validation and Testing

**New Tools:**

```typescript
// Validate blueprint structure
{
  name: 'bluekit_blueprint_validate',
  description: 'Validate blueprint structure, dependencies, and completeness'
}

// Test blueprint execution
{
  name: 'bluekit_blueprint_test',
  description: 'Execute blueprint in test mode to verify it works'
}

// Dry-run mode
{
  name: 'bluekit_blueprint_dryRun',
  description: 'Simulate blueprint execution without making changes'
}
```

#### 4.3 Better Error Messages

**Enhancement:**

```typescript
class ErrorFormatter {
  format(error: Error, context: any): string {
    if (error instanceof ValidationError) {
      return this.formatValidationError(error, context);
    }
    
    if (error instanceof FileNotFoundError) {
      return this.formatFileNotFoundError(error, context);
    }
    
    // ... other error types
  }
  
  private formatValidationError(error: ValidationError, context: any): string {
    return `
❌ Validation Error

Field: ${error.field}
Value: ${JSON.stringify(error.value)}
Issue: ${error.message}

Expected schema:
${this.formatSchema(context.schema)}

💡 Tip: ${this.getSuggestion(error, context)}
    `.trim();
  }
}
```

### 5. Performance Optimizations

#### 5.1 Lazy Loading of Tool Sets

**Current State:**
All tool sets instantiated at startup.

**Optimization:**

```typescript
export class BlueKitTools {
  private readonly toolSetFactories: Map<string, () => IToolSet> = new Map();
  private readonly toolSetCache: Map<string, IToolSet> = new Map();
  
  constructor() {
    // Register factories instead of instances
    this.toolSetFactories.set('kit', () => new KitTools());
    this.toolSetFactories.set('blueprint', () => new BlueprintTools());
    // ...
  }
  
  getToolHandler(toolName: string): ToolHandler | undefined {
    // Lazy load tool sets as needed
    for (const [name, factory] of this.toolSetFactories) {
      if (!this.toolSetCache.has(name)) {
        this.toolSetCache.set(name, factory());
      }
      
      const toolSet = this.toolSetCache.get(name)!;
      const handler = toolSet.getToolHandler(toolName);
      if (handler) return handler;
    }
    
    return undefined;
  }
}
```

#### 5.2 Parallel File Operations

**Enhancement:**

```typescript
class FileOperationsExecutor {
  async executeBatch(
    operations: FileOperation[],
    config: AppConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    // Group operations by type for parallelization
    const copyOps = operations.filter(op => op.type === 'copy');
    const templateOps = operations.filter(op => op.type === 'template');
    const generateOps = operations.filter(op => op.type === 'generate');
    
    // Execute in parallel where safe
    await Promise.all([
      Promise.all(copyOps.map(op => this.execute(op, config, sourcePath, targetPath))),
      Promise.all(templateOps.map(op => this.execute(op, config, sourcePath, targetPath))),
      // Generate ops might need sequential execution
      ...generateOps.map(op => this.execute(op, config, sourcePath, targetPath))
    ]);
  }
}
```

### 6. Integration Opportunities

#### 6.1 MCP Resource Expansion

**Enhancement:**
Expose more resources beyond prompt definitions.

```typescript
// Expose blueprint examples
private getBlueprintResources(): Resource[] {
  const blueprintsDir = path.join(this.projectPath, '.bluekit', 'blueprints');
  // ... scan and expose as resources
}

// Expose kit templates
private getKitResources(): Resource[] {
  const kitsDir = path.join(this.projectPath, '.bluekit', 'kits');
  // ... scan and expose as resources
}
```

#### 6.2 Webhook Support

**New Feature:**
Allow external systems to trigger blueprint execution.

```typescript
// HTTP server mode (optional)
class BlueKitHTTPServer {
  async start(port: number): void {
    const app = express();
    
    app.post('/webhook/blueprint/execute', async (req, res) => {
      const { blueprintId, config } = req.body;
      
      // Execute blueprint
      const result = await this.executeBlueprint(blueprintId, config);
      
      res.json({ success: true, result });
    });
    
    app.listen(port);
  }
}
```

#### 6.3 IDE Integration

**Proposed:**
VS Code extension or Language Server Protocol support.

```typescript
// LSP server
class BlueKitLSPServer {
  // Provide autocomplete for blueprint configs
  // Validate blueprints in real-time
  // Show blueprint structure in outline
  // Quick actions for common operations
}
```

### 7. Testing Infrastructure

#### 7.1 Unit Test Framework

**Proposed Structure:**

```typescript
// Test utilities
class BlueKitTestUtils {
  static createMockToolSet(): IToolSet {
    // ... mock implementation
  }
  
  static createTempProject(): string {
    // ... create temporary project directory
  }
  
  static cleanupTempProject(path: string): void {
    // ... cleanup
  }
}

// Example test
describe('KitTools', () => {
  it('should generate kit with valid YAML front matter', async () => {
    const tools = new KitTools();
    const tempProject = BlueKitTestUtils.createTempProject();
    
    // ... test implementation
    
    BlueKitTestUtils.cleanupTempProject(tempProject);
  });
});
```

#### 7.2 Integration Tests

**Proposed:**

```typescript
// End-to-end blueprint execution tests
describe('Blueprint Execution', () => {
  it('should execute complete blueprint workflow', async () => {
    // 1. Create blueprint
    // 2. Execute all tasks
    // 3. Verify output
    // 4. Cleanup
  });
});
```

### 8. Documentation Enhancements

#### 8.1 Auto-Generated API Documentation

**Implementation:**

```typescript
// Tool definition to OpenAPI schema converter
class APIDocumentationGenerator {
  generateOpenAPISchema(tools: ToolDefinition[]): OpenAPISchema {
    // Convert tool definitions to OpenAPI 3.0 schema
  }
  
  generateMarkdownDocs(tools: ToolDefinition[]): string {
    // Generate markdown documentation
  }
}
```

#### 8.2 Interactive Examples

**Proposed:**
Include runnable examples in documentation that can be executed.

```markdown
## Example: Creating a Kit

\`\`\`typescript
// This example can be executed
const result = await bluekit_kit_createKit({
  description: "A React button component",
  projectPath: "./my-project"
});
\`\`\`
```

## Implementation Priority

### High Priority (Immediate Value)
1. ✅ Git source reference support
2. ✅ Enhanced error handling and validation
3. ✅ Blueprint extraction from clones
4. ✅ Caching layer for performance

### Medium Priority (Significant Value)
1. ⚠️ AI-powered code generation
2. ⚠️ Plugin system for tool sets
3. ⚠️ Observability and logging
4. ⚠️ Bidirectional clone ↔ blueprint workflow

### Low Priority (Nice to Have)
1. 🔵 Interactive CLI mode
2. 🔵 Webhook support
3. 🔵 IDE integration
4. 🔵 Multi-agent workflow support

## Migration Path

When implementing these enhancements:

1. **Start with non-breaking changes**: Add new features alongside existing ones
2. **Use feature flags**: Allow gradual rollout
3. **Maintain backward compatibility**: Don't break existing tool calls
4. **Add comprehensive tests**: Ensure reliability
5. **Document thoroughly**: Help users adopt new features

## Conclusion

The BlueKit MCP Server has a solid foundation that can be extended in many directions. The most impactful improvements are:

1. **Completing missing implementations** (git support, AI generation)
2. **Enhancing workflows** (bidirectional clone ↔ blueprint)
3. **Improving developer experience** (better errors, validation, testing)
4. **Adding observability** (logging, metrics, debugging)

By following this guide, you can systematically enhance the server while maintaining its clean architecture and extensibility.
