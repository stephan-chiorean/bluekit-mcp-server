import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

export class BlueprintTools extends BaseToolSet {
  protected createToolDefinitions(): ToolDefinition[] {
    return [
      // Blueprint tools will be added here
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      // Blueprint tool handlers will be added here
    };
  }
}

