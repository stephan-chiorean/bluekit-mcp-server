import { ToolDefinition, ToolHandler } from './types.js';
import { IToolSet } from './tools/BaseToolSet.js';
import { KitTools } from './tools/KitTools.js';
import { BlueprintTools } from './tools/BlueprintTools.js';
import { TaskTools } from './tools/TaskTools.js';
import { WalkthroughTools } from './tools/WalkthroughTools.js';
import { AgentTools } from './tools/AgentTools.js';
import { CollectionTools } from './tools/CollectionTools.js';
import { CommonTools } from './tools/CommonTools.js';
import { DiagramTools } from './tools/DiagramTools.js';
import { CloneTools } from './tools/CloneTools.js';

/**
 * Main BlueKitTools class that aggregates all tool sets
 */
export class BlueKitTools {
  private readonly kitTools: KitTools;
  private readonly blueprintTools: BlueprintTools;
  private readonly taskTools: TaskTools;
  private readonly walkthroughTools: WalkthroughTools;
  private readonly agentTools: AgentTools;
  private readonly collectionTools: CollectionTools;
  private readonly commonTools: CommonTools;
  private readonly diagramTools: DiagramTools;
  private readonly cloneTools: CloneTools;
  private readonly allToolSets: IToolSet[];

  constructor() {
    this.kitTools = new KitTools();
    this.blueprintTools = new BlueprintTools();
    this.taskTools = new TaskTools();
    this.walkthroughTools = new WalkthroughTools();
    this.agentTools = new AgentTools();
    this.collectionTools = new CollectionTools();
    this.commonTools = new CommonTools();
    this.diagramTools = new DiagramTools();
    this.cloneTools = new CloneTools();

    // Set tool sets for batch execution
    this.commonTools.setToolSets([
      this.kitTools,
      this.blueprintTools,
      this.taskTools,
      this.walkthroughTools,
      this.agentTools,
      this.collectionTools,
      this.commonTools,
      this.diagramTools,
      this.cloneTools
    ]);

    this.allToolSets = [
      this.kitTools,
      this.blueprintTools,
      this.taskTools,
      this.walkthroughTools,
      this.agentTools,
      this.collectionTools,
      this.commonTools,
      this.diagramTools,
      this.cloneTools
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
