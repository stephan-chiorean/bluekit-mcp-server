import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';

interface SourceReference {
  type: 'local' | 'global' | 'git';
  path?: string;
  gitUrl?: string;
  gitRef?: string;
  preservePaths?: string[];
}

interface GlobalRegistryEntry {
  projectPath: string;
  createdAt: string;
}

export class SourceResolver {
  /**
   * Resolve a source reference to an absolute path
   */
  async resolve(ref: SourceReference, targetPath?: string): Promise<string> {
    switch (ref.type) {
      case 'local':
        return this.resolveLocal(ref.path);
      case 'global':
        return this.resolveGlobal(ref.path);
      case 'git':
        if (!targetPath) {
          throw new Error('targetPath is required for git source references');
        }
        return this.resolveGit(ref.gitUrl!, ref.gitRef, targetPath);
      default:
        throw new Error(`Unknown source reference type: ${(ref as any).type}`);
    }
  }

  /**
   * Resolve a local path to absolute path
   */
  private resolveLocal(localPath?: string): string {
    if (!localPath) {
      throw new Error('path is required for local source references');
    }

    // If already absolute, normalize and return
    if (path.isAbsolute(localPath)) {
      return path.normalize(localPath);
    }

    // Otherwise resolve relative to current working directory
    return path.resolve(process.cwd(), localPath);
  }

  /**
   * Resolve a global registry ID to the project path
   */
  private resolveGlobal(registryId?: string): string {
    if (!registryId) {
      throw new Error('path (registry ID) is required for global source references');
    }

    const registry = this.readGlobalRegistry();
    const entry = registry[registryId];

    if (!entry) {
      throw new Error(`Blueprint with ID "${registryId}" not found in global registry`);
    }

    return entry.projectPath;
  }

  /**
   * Resolve a git repository to a local path (clone if needed)
   */
  private async resolveGit(gitUrl: string, gitRef: string | undefined, targetPath: string): Promise<string> {
    if (!gitUrl) {
      throw new Error('gitUrl is required for git source references');
    }

    // Create a temporary clone directory
    const cloneDir = path.join(targetPath, '.bluekit', 'tmp', 'git-sources', this.gitUrlToFolderName(gitUrl));

    // If already cloned, just checkout the ref
    if (fs.existsSync(cloneDir)) {
      if (gitRef) {
        // TODO: Implement git checkout for specific ref
        // For now, just use what's already there
      }
      return cloneDir;
    }

    // TODO: Implement git clone
    // For MVP, throw error that git sources are not yet supported
    throw new Error('Git source references are not yet implemented. Please use local or global sources.');
  }

  /**
   * Copy preserved paths from source to target
   */
  async copyPreservedPaths(
    sourcePath: string,
    targetPath: string,
    preservePaths: string[]
  ): Promise<void> {
    // Validate source exists
    if (!fs.existsSync(sourcePath)) {
      throw new Error(`Source path does not exist: ${sourcePath}`);
    }

    // Ensure target directory exists
    if (!fs.existsSync(targetPath)) {
      fs.mkdirSync(targetPath, { recursive: true });
    }

    // Copy each preserved path
    for (const preservePath of preservePaths) {
      const source = path.join(sourcePath, preservePath);
      const dest = path.join(targetPath, preservePath);

      // Check if source exists
      if (!fs.existsSync(source)) {
        console.warn(`[SourceResolver] Warning: Preserved path does not exist: ${source}`);
        continue;
      }

      // Ensure destination parent directory exists
      const destDir = path.dirname(dest);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      // Copy the file/directory
      try {
        await fse.copy(source, dest, { overwrite: false, errorOnExist: false });
        console.log(`[SourceResolver] Copied: ${preservePath}`);
      } catch (error) {
        throw new Error(`Failed to copy ${preservePath}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
  }

  /**
   * Read the global blueprint registry
   */
  private readGlobalRegistry(): Record<string, GlobalRegistryEntry> {
    const registryPath = this.getGlobalRegistryPath();

    if (!fs.existsSync(registryPath)) {
      return {};
    }

    try {
      const content = fs.readFileSync(registryPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      console.error('[SourceResolver] Failed to read global registry:', error);
      return {};
    }
  }

  /**
   * Get the global blueprint registry path
   */
  private getGlobalRegistryPath(): string {
    const homeDir = process.env.HOME || process.env.USERPROFILE || '~';
    return path.join(homeDir, '.bluekit', 'blueprintRegistry.json');
  }

  /**
   * Convert git URL to a safe folder name
   */
  private gitUrlToFolderName(gitUrl: string): string {
    return gitUrl
      .replace(/^https?:\/\//, '')
      .replace(/\.git$/, '')
      .replace(/[^a-zA-Z0-9]/g, '-');
  }
}
