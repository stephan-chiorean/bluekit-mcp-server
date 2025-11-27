import { ToolDefinition, ToolHandler } from './types.js';
import { IToolSet } from './tools/BaseToolSet.js';
import { KitTools } from './tools/KitTools.js';
import { BlueprintTools } from './tools/BlueprintTools.js';
import { WalkthroughTools } from './tools/WalkthroughTools.js';
import { AgentTools } from './tools/AgentTools.js';
import { CollectionTools } from './tools/CollectionTools.js';
import { CommonTools } from './tools/CommonTools.js';

/**
 * Main BlueKitTools class that aggregates all tool sets
 */
export class BlueKitTools {
  private readonly kitTools: KitTools;
  private readonly blueprintTools: BlueprintTools;
  private readonly walkthroughTools: WalkthroughTools;
  private readonly agentTools: AgentTools;
  private readonly collectionTools: CollectionTools;
  private readonly commonTools: CommonTools;
  private readonly allToolSets: IToolSet[];

  constructor() {
    this.kitTools = new KitTools();
    this.blueprintTools = new BlueprintTools();
    this.walkthroughTools = new WalkthroughTools();
    this.agentTools = new AgentTools();
    this.collectionTools = new CollectionTools();
    this.commonTools = new CommonTools();
    
    // Set tool sets for batch execution
    this.commonTools.setToolSets([
      this.kitTools,
      this.blueprintTools,
      this.walkthroughTools,
      this.agentTools,
      this.collectionTools,
      this.commonTools
    ]);

    this.allToolSets = [
      this.kitTools,
      this.blueprintTools,
      this.walkthroughTools,
      this.agentTools,
      this.collectionTools,
      this.commonTools
    ];
  }

  getToolDefinitions(): ToolDefinition[] {
    const allDefinitions: ToolDefinition[] = [];
    
    for (const toolSet of this.allToolSets) {
      allDefinitions.push(...toolSet.getToolDefinitions());
    }
    
    return allDefinitions;
  }

  getToolHandler(toolName: string): ToolHandler | undefined {
    // Try each tool set in order
    for (const toolSet of this.allToolSets) {
      const handler = toolSet.getToolHandler(toolName);
      if (handler) {
        return handler;
      }
    }
    
    return undefined;
  }
}
