import * as fs from 'fs';
import * as path from 'path';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

interface ExecuteTaskParams {
  projectPath: string;
  blueprintId: string;
  taskFile: string;
}

export class TaskTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_task_executeTask',
        description: 'Execute a specific task from a blueprint. This tool retrieves the task file and blueprint metadata, providing full context for implementation. Use this when a user provides a task file or asks to implement/run a specific blueprint task.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project containing the blueprint'
            },
            blueprintId: {
              type: 'string',
              description: 'ID of the blueprint containing the task'
            },
            taskFile: {
              type: 'string',
              description: 'Name of the task file to execute (e.g., "project-setup.md")'
            }
          },
          required: ['projectPath', 'blueprintId', 'taskFile']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_task_executeTask': (params) => this.handleExecuteTask(params)
    };
  }

  private handleExecuteTask(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const blueprintId = params.blueprintId as string;
    const taskFile = params.taskFile as string;

    // Validate inputs
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    if (!blueprintId || typeof blueprintId !== 'string') {
      throw new Error('blueprintId is required and must be a string');
    }
    if (!taskFile || typeof taskFile !== 'string') {
      throw new Error('taskFile is required and must be a string');
    }

    // Resolve paths
    const resolvedProjectPath = path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(process.cwd(), projectPath);

    const blueprintFolder = path.join(resolvedProjectPath, '.bluekit', 'blueprints', blueprintId);
    const blueprintJsonPath = path.join(blueprintFolder, 'blueprint.json');
    const taskFilePath = path.join(blueprintFolder, taskFile);

    try {
      // Verify blueprint exists
      if (!fs.existsSync(blueprintFolder)) {
        throw new Error(`Blueprint "${blueprintId}" not found in project`);
      }

      if (!fs.existsSync(blueprintJsonPath)) {
        throw new Error(`blueprint.json not found for blueprint "${blueprintId}"`);
      }

      if (!fs.existsSync(taskFilePath)) {
        throw new Error(`Task file "${taskFile}" not found in blueprint "${blueprintId}"`);
      }

      // Read blueprint metadata
      const blueprintContent = fs.readFileSync(blueprintJsonPath, 'utf8');
      const blueprint = JSON.parse(blueprintContent);

      // Read task content
      const taskContent = fs.readFileSync(taskFilePath, 'utf8');

      // Find task metadata in blueprint
      let taskMetadata = null;
      let layerInfo = null;
      let taskPosition = 0;
      let totalTasks = 0;

      for (const layer of blueprint.layers) {
        for (let i = 0; i < layer.tasks.length; i++) {
          totalTasks++;
          if (layer.tasks[i].taskFile === taskFile) {
            taskMetadata = layer.tasks[i];
            layerInfo = {
              id: layer.id,
              order: layer.order,
              name: layer.name,
              totalLayers: blueprint.layers.length,
              taskPosition: i + 1,
              tasksInLayer: layer.tasks.length
            };
          }
        }
      }

      if (!taskMetadata || !layerInfo) {
        throw new Error(`Task "${taskFile}" not found in blueprint metadata`);
      }

      // Build execution context response
      let response = `🔷 BLUEPRINT TASK EXECUTION\n\n`;
      response += `Blueprint: ${blueprint.name} (${blueprint.id})\n`;
      response += `Version: ${blueprint.version}\n`;
      response += `Description: ${blueprint.description}\n\n`;

      response += `📍 TASK CONTEXT\n\n`;
      response += `Layer: ${layerInfo.order}/${layerInfo.totalLayers} - ${layerInfo.name}\n`;
      response += `Task: ${layerInfo.taskPosition}/${layerInfo.tasksInLayer} in this layer\n`;
      response += `Task ID: ${taskMetadata.id}\n`;
      response += `Description: ${taskMetadata.description}\n\n`;

      response += `📋 EXECUTION INSTRUCTIONS\n\n`;
      response += `You are implementing a blueprint task. Your goal is to:\n`;
      response += `1. Read and understand all steps in the task file below\n`;
      response += `2. Implement each step sequentially and completely\n`;
      response += `3. Run all verification commands to ensure success\n`;
      response += `4. Report any errors immediately\n`;
      response += `5. Only mark this task complete after all verification passes\n\n`;

      response += `⚠️  IMPORTANT:\n`;
      response += `- This is part of a larger blueprint with ${blueprint.layers.length} layers\n`;
      response += `- Do not skip steps or make assumptions\n`;
      response += `- Follow the task instructions exactly as written\n`;
      response += `- Verify your work before proceeding\n\n`;

      response += `─────────────────────────────────────────────────────────\n\n`;
      response += `📄 TASK FILE: ${taskFile}\n\n`;
      response += taskContent;
      response += `\n\n─────────────────────────────────────────────────────────\n\n`;

      response += `✅ COMPLETION CHECKLIST\n\n`;
      response += `After implementing this task, ensure:\n`;
      response += `- [ ] All steps have been completed\n`;
      response += `- [ ] All verification commands pass\n`;
      response += `- [ ] No errors or warnings\n`;
      response += `- [ ] Ready to proceed to next task\n`;

      return [
        {
          type: 'text',
          text: response
        }
      ];
    } catch (error) {
      throw new Error(`Failed to execute task: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}
