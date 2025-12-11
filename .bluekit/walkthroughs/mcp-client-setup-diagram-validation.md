---
id: mcp-client-setup-diagram-validation
alias: MCP Client Setup for Diagram Validation
type: walkthrough
is_base: false
version: 1
tags:
  - mcp
  - architecture
  - validation
description: How the BlueKit MCP server acts as an MCP client to connect to @rtuin/mcp-mermaid-validator for validating mermaid diagrams in diagram generation tools
complexity: comprehensive
format: architecture
---
# MCP Client Setup for Diagram Validation

This walkthrough explains how the BlueKit MCP server acts as an MCP client to connect to a separate MCP server (`@rtuin/mcp-mermaid-validator`) for validating mermaid diagrams. This demonstrates a key architectural pattern: an MCP server can itself be an MCP client to other servers, enabling composition and reuse of specialized services.

## Architecture Overview

The BlueKit MCP server has a layered architecture:

```
┌─────────────────────────────────────────────────────────┐
│         BlueKit MCP Server (MCP Server)                │
│  ┌──────────────────────────────────────────────────┐  │
│  │         DiagramTools (Tool Handler)              │  │
│  │  ┌────────────────────────────────────────────┐  │  │
│  │  │  MermaidValidatorClient (MCP Client)       │  │  │
│  │  │  ┌──────────────────────────────────────┐  │  │  │
│  │  │  │  StdioClientTransport                │  │  │  │
│  │  │  └──────────────────────────────────────┘  │  │  │
│  │  └────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
                        │
                        │ stdio transport
                        │ (spawns subprocess)
                        ▼
        ┌───────────────────────────────────────┐
        │  @rtuin/mcp-mermaid-validator          │
        │  (External MCP Server)                 │
        │  - validateMermaid tool                │
        └───────────────────────────────────────┘
```

### Key Components

1. **BlueKit MCP Server**: The main MCP server that exposes BlueKit tools
2. **DiagramTools**: A tool set that handles diagram generation and validation
3. **MermaidValidatorClient**: An MCP client that connects to the external validator
4. **@rtuin/mcp-mermaid-validator**: An external MCP server specialized in mermaid validation

## MermaidValidatorClient Implementation

The `MermaidValidatorClient` class (`src/services/MermaidValidatorClient.ts`) implements the MCP client pattern.

### Class Structure

```typescript
export class MermaidValidatorClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isInitialized: boolean = false;
  private readonly enabled: boolean;
  private readonly timeout: number;
}
```

### Initialization Flow

The client initializes asynchronously when `DiagramTools` is constructed:

```typescript:src/services/MermaidValidatorClient.ts
async initialize(): Promise<void> {
  if (!this.enabled) {
    console.error('[MermaidValidator] Disabled via configuration');
    return;
  }

  try {
    // Create stdio transport - it will spawn the process internally
    this.transport = new StdioClientTransport({
      command: 'npx',
      args: ['-y', '@rtuin/mcp-mermaid-validator@latest'],
    });

    // Create MCP client
    this.client = new Client(
      {
        name: 'bluekit-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {},
      }
    );

    // Connect to validator
    await this.client.connect(this.transport);
    this.isInitialized = true;
    console.error('[MermaidValidator] Connected to validator MCP');
  } catch (error) {
    console.error('[MermaidValidator] Failed to initialize:', error);
    this.isInitialized = false;
    throw error;
  }
}
```

**Key Points:**

1. **StdioClientTransport**: Uses stdio (standard input/output) to communicate with the external server
2. **Subprocess Spawning**: The transport automatically spawns `npx -y @rtuin/mcp-mermaid-validator@latest` as a subprocess
3. **Client Identity**: The client identifies itself as `bluekit-mcp` version `0.1.0`
4. **Non-blocking**: Initialization happens in the background and doesn't block `DiagramTools` construction

### Configuration

The client can be disabled via environment variable:

```typescript
this.enabled = process.env.ENABLE_MERMAID_MCP_VALIDATION !== 'false';
this.timeout = parseInt(process.env.MERMAID_VALIDATOR_TIMEOUT || '10000', 10);
```

- `ENABLE_MERMAID_MCP_VALIDATION`: Set to `'false'` to disable MCP validation (defaults to enabled)
- `MERMAID_VALIDATOR_TIMEOUT`: Timeout in milliseconds (defaults to 10000ms)

## Integration with DiagramTools

`DiagramTools` uses the validator client during diagram generation:

```typescript:src/tools/DiagramTools.ts
export class DiagramTools extends BaseToolSet {
  private validatorClient: MermaidValidatorClient;

  constructor() {
    super();
    this.validatorClient = new MermaidValidatorClient();
    // Initialize validator in background - don't block construction
    this.validatorClient.initialize().catch(err =>
      console.error('[DiagramTools] Validator initialization failed:', err)
    );
  }
}
```

### Validation Flow

When generating a diagram, `handleGenerateDiagram` validates the mermaid code:

```typescript:src/tools/DiagramTools.ts
// Extract mermaid code for validation
const mermaidCode = this.extractMermaidCode(contentWithFrontMatter);

// Validate with MCP (primary) or fallback to regex validation
let usedFallback = false;
const validationResult = await this.validateWithMCP(mermaidCode)
  .catch(err => {
    console.error('[DiagramTools] MCP validation unavailable, using fallback:', err);
    usedFallback = true;
    return this.validateMermaidSyntax(contentWithFrontMatter);
  });
```

**Validation Strategy:**

1. **Primary**: Attempts MCP validation via `MermaidValidatorClient`
2. **Fallback**: If MCP validation fails, uses local regex-based validation
3. **Auto-fixes**: Fallback validation can auto-fix common syntax issues (e.g., `@` symbols, pipe characters)

### Calling the External Tool

The `validate` method calls the `validateMermaid` tool on the external server:

```typescript:src/services/MermaidValidatorClient.ts
async validate(mermaidCode: string): Promise<ValidationResult> {
  if (!this.isInitialized || !this.client) {
    throw new Error('Validator not initialized');
  }

  try {
    // Call validateMermaid tool on the MCP server
    const result = await this.client.callTool({
      name: 'validateMermaid',
      arguments: {
        diagram: mermaidCode,
      },
    });

    // Parse response
    const content = result.content as Array<{ type: string; text?: string; data?: string }>;

    const textContent = content.filter((c: { type: string }) => c.type === 'text');
    const imageContent = content.find((c: { type: string }) => c.type === 'image');

    // Check if validation succeeded
    const isValid = textContent.some((c: { type: string; text?: string }) => {
      return c.text && c.text.toLowerCase().includes('valid');
    });

    if (!isValid) {
      // Extract error messages from text content
      const errors = textContent
        .filter((c: { type: string; text?: string }) => c.text)
        .map((c: { type: string; text?: string }) => c.text || '');
      return { isValid: false, errors };
    }

    // Diagram is valid
    return {
      isValid: true,
      renderedImage: imageContent && imageContent.type === 'image' ? imageContent.data : undefined,
    };
  } catch (error) {
    // Re-throw to trigger fallback validation
    throw new Error(`Validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}
```

**Response Handling:**

- The external server returns content with `type: 'text'` (validation status/errors) and optionally `type: 'image'` (rendered PNG if valid)
- The client parses the response to determine validity and extract errors
- If validation fails, errors are extracted from text content
- If validation succeeds, a rendered image may be included

## Error Handling and Resilience

The system is designed to be resilient:

### Graceful Degradation

1. **Initialization Failures**: If the validator client fails to initialize, it doesn't crash the server
2. **Validation Failures**: If MCP validation fails, the system falls back to local regex validation
3. **Auto-fixes**: The fallback validator can automatically fix common syntax issues

### Error Flow

```
┌─────────────────────┐
│  Validate Request   │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  Try MCP Validation │
└──────────┬──────────┘
           │
    ┌──────┴──────┐
    │             │
    ▼             ▼
┌─────────┐  ┌──────────────┐
│ Success │  │ MCP Failure  │
└─────────┘  └──────┬───────┘
                   │
                   ▼
          ┌─────────────────┐
          │ Fallback Regex  │
          │   Validation    │
          └────────┬────────┘
                   │
          ┌────────┴────────┐
          │                 │
          ▼                 ▼
    ┌──────────┐      ┌──────────┐
    │ Valid    │      │ Invalid  │
    └──────────┘      └──────────┘
```

## Communication Protocol

The MCP client communicates with the external server using the Model Context Protocol:

1. **Transport**: Stdio (standard input/output)
2. **Protocol**: JSON-RPC 2.0 messages over stdio
3. **Tool Call**: `validateMermaid` with `{ diagram: string }` argument
4. **Response**: Content array with text and optional image data

### Example Tool Call

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "method": "tools/call",
  "params": {
    "name": "validateMermaid",
    "arguments": {
      "diagram": "graph TB\n    A[Start] --> B[End]"
    }
  }
}
```

## Dependencies

The implementation relies on:

- `@modelcontextprotocol/sdk`: MCP SDK for client and transport
- `@rtuin/mcp-mermaid-validator`: External MCP server (installed via npx)

From `package.json`:

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.23.0",
    "@rtuin/mcp-mermaid-validator": "^0.7.0"
  }
}
```

## Design Decisions

### Why Use an External MCP Server?

1. **Separation of Concerns**: Diagram validation is a specialized task
2. **Reusability**: The validator can be used by other MCP servers
3. **Maintainability**: Validation logic is isolated and can be updated independently
4. **Performance**: The validator can be optimized for its specific task

### Why Stdio Transport?

1. **Simplicity**: No network configuration required
2. **Isolation**: Each subprocess is isolated
3. **Portability**: Works across platforms
4. **Standard**: Stdio is the standard transport for MCP subprocess servers

### Why Background Initialization?

1. **Non-blocking**: Server startup isn't delayed by validator initialization
2. **Resilience**: Server can start even if validator is unavailable
3. **User Experience**: Tools are immediately available, validation happens on-demand

## Testing and Debugging

### Enabling/Disabling Validation

Set environment variable:
```bash
ENABLE_MERMAID_MCP_VALIDATION=false
```

### Monitoring

The client logs initialization and validation status:
- `[MermaidValidator] Connected to validator MCP` - Success
- `[MermaidValidator] Failed to initialize` - Initialization failure
- `[DiagramTools] MCP validation unavailable, using fallback` - Fallback triggered

### Common Issues

1. **Validator Not Found**: Ensure `@rtuin/mcp-mermaid-validator` is available via npx
2. **Initialization Timeout**: Increase `MERMAID_VALIDATOR_TIMEOUT` if needed
3. **Transport Errors**: Check that stdio is available and not redirected

## Summary

This architecture demonstrates how an MCP server can act as an MCP client to compose functionality from specialized external servers. The key patterns are:

1. **Client Wrapper**: `MermaidValidatorClient` wraps the MCP client logic
2. **Transport Configuration**: Uses `StdioClientTransport` to spawn subprocess
3. **Graceful Degradation**: Falls back to local validation if MCP fails
4. **Background Initialization**: Non-blocking startup for better UX
5. **Error Handling**: Comprehensive error handling with fallback strategies

This pattern enables the BlueKit MCP server to leverage specialized validation services while maintaining resilience and performance.
