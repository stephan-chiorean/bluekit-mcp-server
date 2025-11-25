import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class WalkthroughTools extends BaseToolSet {
  protected createToolDefinitions(): ToolDefinition[] {
    return [
      // Walkthrough tools will be added here
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      // Walkthrough tool handlers will be added here
    };
  }
}

