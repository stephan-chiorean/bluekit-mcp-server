import * as os from 'os';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import Database from 'better-sqlite3';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

/**
 * Common tools shared across all tool sets (ping, batchExecute, init_project)
 */
export class CommonTools extends BaseToolSet {
  private allToolSets: BaseToolSet[] = [];

  setToolSets(toolSets: BaseToolSet[]): void {
    this.allToolSets = toolSets;
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_ping',
        description: 'Health check for BlueKit MCP server',
        inputSchema: {
          type: 'object',
          properties: {},
          required: []
        }
      },
      {
        name: 'bluekit_batchExecute',
        description: 'Execute multiple tool operations in sequence (single approval)',
        inputSchema: {
          type: 'object',
          properties: {
            tasks: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  name: { type: 'string' },
                  params: { type: 'object' }
                },
                required: ['name', 'params']
              }
            }
          },
          required: ['tasks']
        }
      },
      {
        name: 'bluekit.init_project',
        description: 'Initialize a BlueKit project by linking it to the BlueKit store. Creates ~/.bluekit directory and adds project to SQLite database.',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the project directory to initialize'
            },
            confirm: {
              type: 'boolean',
              description: 'Confirm creation of ~/.bluekit directory if it does not exist'
            }
          },
          required: ['projectPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_ping': () => this.handlePing(),
      'bluekit_batchExecute': (params) => this.handleBatchExecute(params),
      'bluekit.init_project': (params) => this.handleInitProject(params)
    };
  }

  private handlePing(): Array<{ type: 'text'; text: string }> {
    return [
      { type: 'text', text: 'pong from BlueKit!' }
    ];
  }

  private handleBatchExecute(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const tasks = params.tasks as Array<{ name: string; params: Record<string, unknown> }>;
    
    if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
      throw new Error('tasks is required and must be a non-empty array');
    }

    const results: Array<{ task: string; success: boolean; result?: unknown; error?: string }> = [];

    for (const task of tasks) {
      if (!task.name || typeof task.name !== 'string') {
        results.push({
          task: 'unknown',
          success: false,
          error: 'Task name is required and must be a string'
        });
        continue;
      }

      if (!task.params || typeof task.params !== 'object') {
        results.push({
          task: task.name,
          success: false,
          error: 'Task params is required and must be a object'
        });
        continue;
      }

      // Try to find handler in any of the tool sets
      let handler: ToolHandler | undefined;
      for (const toolSet of this.allToolSets) {
        handler = toolSet.getToolHandler(task.name);
        if (handler) break;
      }

      // Also check common tools
      if (!handler) {
        handler = this.getToolHandler(task.name);
      }

      if (!handler) {
        results.push({
          task: task.name,
          success: false,
          error: `Tool not found: ${task.name}`
        });
        continue;
      }

      try {
        const result = handler(task.params);
        results.push({
          task: task.name,
          success: true,
          result
        });
      } catch (error) {
        results.push({
          task: task.name,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const successCount = results.filter(r => r.success).length;
    const failureCount = results.filter(r => !r.success).length;

    return [
      {
        type: 'text',
        text: `✅ Batch: ${successCount} succeeded, ${failureCount} failed\n\n${JSON.stringify(results, null, 2)}`
      }
    ];
  }

  private handleInitProject(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const confirm = params.confirm as boolean | undefined;
    
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }

    const homeDir = os.homedir();
    const bluekitStoreDir = path.join(homeDir, '.bluekit');
    const dbPath = path.join(bluekitStoreDir, 'bluekit.db');

    // Check if ~/.bluekit directory exists
    if (!fs.existsSync(bluekitStoreDir)) {
      if (confirm !== true) {
        return [
          {
            type: 'text',
            text: `⚠️  The BlueKit store directory (~/.bluekit) does not exist.\n\n` +
                  `Creating this directory will link the current project to your BlueKit store.\n` +
                  `This allows the BlueKit desktop app to discover and manage your projects.\n\n` +
                  `Project path: ${projectPath}\n\n` +
                  `To proceed, run the command again with --confirm flag, or answer 'yes' when prompted.`
          }
        ];
      }

      try {
        fs.mkdirSync(bluekitStoreDir, { recursive: true });
      } catch (error) {
        throw new Error(`Failed to create ~/.bluekit directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }

    const normalizedProjectPath = path.resolve(projectPath);
    const projectName = path.basename(projectPath);
    const now = Date.now();

    // Connect to database
    let db: Database.Database;
    try {
      db = new Database(dbPath);
      
      // Ensure projects table exists (in case database is new)
      // Note: Schema matches Rust migration exactly (no UNIQUE on path)
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY NOT NULL,
          name TEXT NOT NULL,
          path TEXT NOT NULL,
          description TEXT,
          tags TEXT,
          git_connected INTEGER NOT NULL DEFAULT 0,
          git_url TEXT,
          git_branch TEXT,
          git_remote TEXT,
          last_commit_sha TEXT,
          last_synced_at INTEGER,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL,
          last_opened_at INTEGER
        )
      `);
      
      // Create indexes if they don't exist (matching Rust migration)
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_projects_git_connected ON projects(git_connected);
        CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
      `);
    } catch (error) {
      throw new Error(`Failed to connect to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    try {
      // Check if project already exists by path
      const existing = db.prepare('SELECT id, name, description FROM projects WHERE path = ?').get(normalizedProjectPath) as { id: string; name: string; description: string | null } | undefined;

      let action: string;
      let projectId: string;

      if (existing) {
        // Update existing project
        action = 'updated';
        projectId = existing.id;
        
        db.prepare(`
          UPDATE projects 
          SET name = ?, updated_at = ?
          WHERE path = ?
        `).run(projectName, now, normalizedProjectPath);
      } else {
        // Insert new project
        action = 'added';
        projectId = crypto.randomUUID(); // Use UUID to match Rust implementation
        
        db.prepare(`
          INSERT INTO projects (
            id, name, path, description, tags, git_connected, git_url, git_branch,
            git_remote, last_commit_sha, last_synced_at, created_at, updated_at, last_opened_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          projectId,
          projectName,
          normalizedProjectPath,
          null, // description
          null, // tags
          0,    // git_connected
          null, // git_url
          null, // git_branch
          null, // git_remote
          null, // last_commit_sha
          null, // last_synced_at
          now,  // created_at
          now,  // updated_at
          null  // last_opened_at
        );
      }

      // Verify the project was inserted/updated correctly
      const verifyProject = db.prepare('SELECT id, name, path FROM projects WHERE id = ?').get(projectId) as { id: string; name: string; path: string } | undefined;
      
      if (!verifyProject) {
        db.close();
        throw new Error('Failed to verify project was saved to database');
      }

      // Get total count of projects
      const totalProjects = db.prepare('SELECT COUNT(*) as count FROM projects').get() as { count: number };
      
      db.close();

      return [
        {
          type: 'text',
          text: `✅ Project ${action} to BlueKit database!\n\n` +
                `Database location: ${dbPath}\n` +
                `Project path: ${normalizedProjectPath}\n` +
                `Project ID: ${projectId}\n` +
                `Project name: ${verifyProject.name}\n` +
                `Total projects in database: ${totalProjects.count}\n\n` +
                `Note: If the project doesn't appear in the BlueKit app, try refreshing the projects list or restarting the app.`
        }
      ];
    } catch (error) {
      db.close();
      throw new Error(`Failed to write to database: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

