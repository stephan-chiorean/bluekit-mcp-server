import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import { ToolDefinition, ToolHandler } from '../types.js';
import { BaseToolSet } from './BaseToolSet.js';

interface CloneMetadata {
  id: string;
  name: string;
  description: string;
  gitUrl: string;
  gitCommit: string;
  gitBranch?: string;
  gitTag?: string;
  tags: string[];
  createdAt: string;
  metadata?: Record<string, any>;
}

export class CloneTools extends BaseToolSet {
  constructor() {
    super();
  }

  protected createToolDefinitions(): ToolDefinition[] {
    return [
      {
        name: 'bluekit_clone_register',
        description: 'Register a git repository snapshot as a clone. Automatically detects git URL, current commit, branch, and tags. Adds to projectRegistry.json for UI display. Use when user says "clone this project" or "save this as a clone".',
        inputSchema: {
          type: 'object',
          properties: {
            projectPath: {
              type: 'string',
              description: 'Path to the git repository to clone/snapshot'
            },
            name: {
              type: 'string',
              description: 'Display name for the clone (e.g., "BlueKit Foundation")'
            },
            description: {
              type: 'string',
              description: 'Optional description of what this clone represents'
            },
            tags: {
              type: 'array',
              items: { type: 'string' },
              description: 'Optional tags for categorization (e.g., ["foundation", "ui-components"])'
            }
          },
          required: ['projectPath', 'name']
        }
      },
      {
        name: 'bluekit_clone_createProject',
        description: 'Create a new project from a registered clone. Clones the git repository at the exact commit, copies files to target location. Use when user says "create project from clone" or "use the bluekit clone".',
        inputSchema: {
          type: 'object',
          properties: {
            cloneId: {
              type: 'string',
              description: 'ID of the clone to create project from'
            },
            targetPath: {
              type: 'string',
              description: 'Where to create the new project'
            }
          },
          required: ['cloneId', 'targetPath']
        }
      }
    ];
  }

  protected createToolHandlers(): Record<string, ToolHandler> {
    return {
      'bluekit_clone_register': (params) => this.handleRegisterClone(params),
      'bluekit_clone_createProject': (params) => this.handleCreateProject(params)
    };
  }

  /**
   * Register a clone - detects git info and adds to registry
   */
  private handleRegisterClone(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const projectPath = params.projectPath as string;
    const name = params.name as string;
    const description = (params.description as string) || '';
    const tags = (params.tags as string[]) || [];

    // Validate inputs
    if (!projectPath || typeof projectPath !== 'string') {
      throw new Error('projectPath is required and must be a string');
    }
    if (!name || typeof name !== 'string') {
      throw new Error('name is required and must be a string');
    }

    // Resolve absolute path
    const resolvedPath = path.isAbsolute(projectPath)
      ? path.normalize(projectPath)
      : path.resolve(process.cwd(), projectPath);

    // Validate project exists
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Project path does not exist: ${resolvedPath}`);
    }

    // Check if it's a git repository
    const gitDir = path.join(resolvedPath, '.git');
    if (!fs.existsSync(gitDir)) {
      throw new Error(`Not a git repository: ${resolvedPath}`);
    }

    try {
      // Get git information
      const gitInfo = this.getGitInfo(resolvedPath);

      // Generate clone ID
      const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
      const cloneId = `${this.slugify(name)}-${timestamp}`;

      // Create clone metadata
      const clone: CloneMetadata = {
        id: cloneId,
        name,
        description,
        gitUrl: gitInfo.url,
        gitCommit: gitInfo.commit,
        gitBranch: gitInfo.branch,
        gitTag: gitInfo.tag,
        tags,
        createdAt: new Date().toISOString()
      };

      // Add to registry (for the specific project)
      this.addToRegistry(clone, resolvedPath);

      // Build response
      let response = `✅ Clone registered successfully!\n\n`;
      response += `Clone ID: ${cloneId}\n`;
      response += `Name: ${name}\n`;
      response += `Description: ${description || '(none)'}\n\n`;
      response += `📍 Git Information:\n`;
      response += `  Repository: ${gitInfo.url}\n`;
      response += `  Commit: ${gitInfo.commit}\n`;
      if (gitInfo.branch) response += `  Branch: ${gitInfo.branch}\n`;
      if (gitInfo.tag) response += `  Tag: ${gitInfo.tag}\n`;
      response += `\n`;
      if (tags.length > 0) {
        response += `🏷️  Tags: ${tags.join(', ')}\n\n`;
      }
      response += `💡 This clone is now available in your Clones tab!\n`;
      response += `You can create new projects from it using:\n`;
      response += `  bluekit_clone_createProject({ cloneId: "${cloneId}", targetPath: "/path/to/new/project" })\n`;

      return [{ type: 'text', text: response }];
    } catch (error) {
      throw new Error(`Failed to register clone: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Create a project from a clone
   */
  private handleCreateProject(params: Record<string, unknown>): Array<{ type: 'text'; text: string }> {
    const cloneId = params.cloneId as string;
    const targetPath = params.targetPath as string;

    // Validate inputs
    if (!cloneId || typeof cloneId !== 'string') {
      throw new Error('cloneId is required and must be a string');
    }
    if (!targetPath || typeof targetPath !== 'string') {
      throw new Error('targetPath is required and must be a string');
    }

    // Resolve target path
    const resolvedTarget = path.isAbsolute(targetPath)
      ? path.normalize(targetPath)
      : path.resolve(process.cwd(), targetPath);

    // Check if target already exists
    if (fs.existsSync(resolvedTarget)) {
      throw new Error(`Target path already exists: ${resolvedTarget}`);
    }

    try {
      // Load clone from registry
      const clone = this.getCloneFromRegistry(cloneId);
      if (!clone) {
        throw new Error(`Clone not found: ${cloneId}`);
      }

      let response = `🚀 Creating project from clone "${clone.name}"...\n\n`;
      response += `📍 Source: ${clone.gitUrl}\n`;
      response += `📌 Commit: ${clone.gitCommit}\n`;
      response += `📂 Target: ${resolvedTarget}\n\n`;

      // Create temp directory for clone
      const tempDir = path.join(this.getTempDir(), `clone-${Date.now()}`);
      fs.mkdirSync(tempDir, { recursive: true });

      try {
        response += `⏳ Step 1/3: Cloning repository...\n`;

        // Clone the repository
        execSync(`git clone "${clone.gitUrl}" "${tempDir}"`, {
          stdio: 'pipe',
          encoding: 'utf-8'
        });

        response += `✅ Repository cloned\n\n`;
        response += `⏳ Step 2/3: Checking out commit ${clone.gitCommit.substring(0, 7)}...\n`;

        // Checkout specific commit
        execSync(`git -C "${tempDir}" checkout ${clone.gitCommit}`, {
          stdio: 'pipe',
          encoding: 'utf-8'
        });

        response += `✅ Commit checked out\n\n`;
        response += `⏳ Step 3/3: Copying files to ${resolvedTarget}...\n`;

        // Create target directory
        fs.mkdirSync(resolvedTarget, { recursive: true });

        // Copy files (excluding .git)
        this.copyDirectory(tempDir, resolvedTarget, ['.git']);

        response += `✅ Files copied\n\n`;
        response += `🎉 Project created successfully!\n\n`;
        response += `📂 Location: ${resolvedTarget}\n`;
        response += `💡 You can now:\n`;
        response += `  1. cd ${resolvedTarget}\n`;
        response += `  2. git init (if you want version control)\n`;
        response += `  3. Start customizing your project\n`;

      } finally {
        // Clean up temp directory
        if (fs.existsSync(tempDir)) {
          fs.rmSync(tempDir, { recursive: true, force: true });
        }
      }

      return [{ type: 'text', text: response }];
    } catch (error) {
      throw new Error(`Failed to create project: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get git information from a repository
   */
  private getGitInfo(projectPath: string): {
    url: string;
    commit: string;
    branch: string | undefined;
    tag: string | undefined;
  } {
    try {
      // Get remote URL
      const url = execSync('git config --get remote.origin.url', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      // Get current commit hash
      const commit = execSync('git rev-parse HEAD', {
        cwd: projectPath,
        encoding: 'utf-8'
      }).trim();

      // Get current branch (may fail if detached HEAD)
      let branch: string | undefined;
      try {
        branch = execSync('git rev-parse --abbrev-ref HEAD', {
          cwd: projectPath,
          encoding: 'utf-8'
        }).trim();
        if (branch === 'HEAD') branch = undefined; // Detached HEAD
      } catch {
        branch = undefined;
      }

      // Get tag if on a tag
      let tag: string | undefined;
      try {
        tag = execSync('git describe --exact-match --tags HEAD', {
          cwd: projectPath,
          encoding: 'utf-8'
        }).trim();
      } catch {
        tag = undefined;
      }

      return { url, commit, branch, tag };
    } catch (error) {
      throw new Error(`Failed to get git info: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Get the project registry path
   */
  private getRegistryPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return path.join(homeDir, '.bluekit', 'projectRegistry.json');
  }

  /**
   * Get temp directory path
   */
  private getTempDir(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return path.join(homeDir, '.bluekit', 'tmp', 'git-sources');
  }

  /**
   * Get the clones file path for a project
   */
  private getClonesFilePath(projectPath: string): string {
    return path.join(projectPath, '.bluekit', 'clones.json');
  }

  /**
   * Read clones from a project's .bluekit/clones.json file
   */
  private readProjectClones(projectPath: string): CloneMetadata[] {
    const clonesPath = this.getClonesFilePath(projectPath);

    if (!fs.existsSync(clonesPath)) {
      return [];
    }

    try {
      const content = fs.readFileSync(clonesPath, 'utf8');
      const data = JSON.parse(content);

      if (Array.isArray(data)) {
        return data as CloneMetadata[];
      }

      return [];
    } catch (error) {
      console.error(`[CloneTools] Failed to read clones from ${clonesPath}:`, error);
      return [];
    }
  }

  /**
   * Write clones to a project's .bluekit/clones.json file
   */
  private writeProjectClones(projectPath: string, clones: CloneMetadata[]): void {
    const clonesPath = this.getClonesFilePath(projectPath);
    const clonesDir = path.dirname(clonesPath);

    if (!fs.existsSync(clonesDir)) {
      fs.mkdirSync(clonesDir, { recursive: true });
    }

    fs.writeFileSync(clonesPath, JSON.stringify(clones, null, 2), 'utf8');
  }

  /**
   * Add a clone to a project's clones file
   */
  private addToRegistry(clone: CloneMetadata, projectPath: string): void {
    const normalizedProjectPath = path.resolve(projectPath);

    // Verify project is in registry (but don't require it to have clones in registry)
    const registryPath = this.getRegistryPath();
    if (fs.existsSync(registryPath)) {
      try {
        const content = fs.readFileSync(registryPath, 'utf8');
        const registry = JSON.parse(content);
        if (Array.isArray(registry)) {
          const projectExists = registry.some(
            (item: any) => path.resolve(item.path) === normalizedProjectPath
          );
          if (!projectExists) {
            throw new Error(`Project not found in registry: ${normalizedProjectPath}. Please run bluekit_init_project first.`);
          }
        }
      } catch (error) {
        if (error instanceof Error && error.message.includes('not found in registry')) {
          throw error;
        }
        // If registry read fails, continue anyway
      }
    }

    // Read existing clones for this project
    const clones = this.readProjectClones(normalizedProjectPath);

    // Check if clone with same ID already exists
    const existingIndex = clones.findIndex((c) => c.id === clone.id);
    if (existingIndex >= 0) {
      // Update existing
      clones[existingIndex] = clone;
    } else {
      // Add new
      clones.push(clone);
    }

    // Write back to project's clones file
    this.writeProjectClones(normalizedProjectPath, clones);
  }

  /**
   * Get a clone from any project's clones file (searches all projects in registry)
   */
  private getCloneFromRegistry(cloneId: string): CloneMetadata | undefined {
    const registryPath = this.getRegistryPath();

    if (!fs.existsSync(registryPath)) {
      return undefined;
    }

    try {
      const content = fs.readFileSync(registryPath, 'utf8');
      const registry = JSON.parse(content);

      if (!Array.isArray(registry)) {
        return undefined;
      }

      // Search through all projects' clone files
      for (const project of registry) {
        if (project.path && typeof project.path === 'string') {
          const projectPath = path.resolve(project.path);
          if (fs.existsSync(projectPath)) {
            const clones = this.readProjectClones(projectPath);
            const clone = clones.find((c) => c.id === cloneId);
            if (clone) {
              return clone;
            }
          }
        }
      }

      return undefined;
    } catch (error) {
      console.error('[CloneTools] Failed to search for clone:', error);
      return undefined;
    }
  }

  /**
   * Convert string to slug
   */
  private slugify(text: string): string {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
  }

  /**
   * Copy directory recursively, excluding specified paths
   */
  private copyDirectory(source: string, target: string, exclude: string[] = []): void {
    // Create target directory
    if (!fs.existsSync(target)) {
      fs.mkdirSync(target, { recursive: true });
    }

    // Read source directory
    const entries = fs.readdirSync(source, { withFileTypes: true });

    for (const entry of entries) {
      // Skip excluded paths
      if (exclude.includes(entry.name)) {
        continue;
      }

      const sourcePath = path.join(source, entry.name);
      const targetPath = path.join(target, entry.name);

      if (entry.isDirectory()) {
        // Recursively copy directory
        this.copyDirectory(sourcePath, targetPath, exclude);
      } else {
        // Copy file
        fs.copyFileSync(sourcePath, targetPath);
      }
    }
  }
}
