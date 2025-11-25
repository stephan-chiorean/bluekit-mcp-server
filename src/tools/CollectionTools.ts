import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class CollectionTools extends BaseToolSet {
  protected createToolDefinitions(): ToolDefinition[] {
    return [
      // Collection tools will be added here
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      // Collection tool handlers will be added here
    };
  }
}

