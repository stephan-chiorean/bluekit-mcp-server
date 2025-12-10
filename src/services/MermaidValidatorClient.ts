import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

export interface ValidationResult {
  isValid: boolean;
  errors?: string[];
  renderedImage?: string; // Base64 PNG if valid
}

/**
 * MCP client for mermaid diagram validation
 * Spawns @rtuin/mcp-mermaid-validator as subprocess and communicates via stdio
 */
export class MermaidValidatorClient {
  private client: Client | null = null;
  private transport: StdioClientTransport | null = null;
  private isInitialized: boolean = false;
  private readonly enabled: boolean;
  private readonly timeout: number;

  constructor() {
    this.enabled = process.env.ENABLE_MERMAID_MCP_VALIDATION !== 'false';
    this.timeout = parseInt(process.env.MERMAID_VALIDATOR_TIMEOUT || '10000', 10);
  }

  /**
   * Initialize connection to validator MCP server
   * Spawns subprocess running @rtuin/mcp-mermaid-validator
   */
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

  /**
   * Validate mermaid diagram syntax
   * Returns detailed validation result with errors if invalid
   */
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
      // @rtuin/mcp-mermaid-validator returns:
      // - text content with validation status/errors
      // - image content (PNG) if diagram is valid

      const content = result.content as Array<{ type: string; text?: string; data?: string }>;

      const textContent = content.filter((c: { type: string }) => c.type === 'text');
      const imageContent = content.find((c: { type: string }) => c.type === 'image');

      // Check if validation succeeded
      // The text response contains "valid" if diagram is valid
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

  /**
   * Close connection and clean up resources
   */
  async close(): Promise<void> {
    if (this.client && this.transport) {
      try {
        await this.client.close();
      } catch (error) {
        console.error('[MermaidValidator] Error closing client:', error);
      }
    }

    this.isInitialized = false;
    this.client = null;
    this.transport = null;
  }
}
