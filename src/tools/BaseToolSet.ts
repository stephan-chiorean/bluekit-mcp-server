import { ToolDefinition, ToolHandler } from '../types.js';

/**
 * Base interface for all tool sets (Kit, Blueprint, Walkthrough, Collection)
 */
export interface IToolSet {
  getToolDefinitions(): ToolDefinition[];
  getToolHandler(toolName: string): ToolHandler | undefined;
}

/**
 * Base class providing common functionality for tool sets
 */
export abstract class BaseToolSet implements IToolSet {
  protected readonly toolDefinitions: ToolDefinition[];
  protected readonly toolHandlers: Record<string, ToolHandler>;

  constructor() {
    this.toolDefinitions = this.createToolDefinitions();
    this.toolHandlers = this.createToolHandlers();
  }

  getToolDefinitions(): ToolDefinition[] {
    return this.toolDefinitions;
  }

  getToolHandler(toolName: string): ToolHandler | undefined {
    // Normalize tool name: convert underscores to dots for compatibility
    const normalizedToolName = toolName.replace(/_/g, '.');
    return this.toolHandlers[normalizedToolName] || this.toolHandlers[toolName];
  }

  protected abstract createToolDefinitions(): ToolDefinition[];
  protected abstract createToolHandlers(): Record<string, ToolHandler>;

  /**
   * Ensure content ends with a single newline.
   * This prevents inconsistencies when users have different editor settings
   * for "Insert Final Newline" which can create noisy git diffs.
   */
  protected ensureFinalNewline(content: string): string {
    if (!content.endsWith('\n')) {
      return content + '\n';
    }
    return content;
  }
}

