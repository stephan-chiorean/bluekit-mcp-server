import * as fs from 'fs';
import * as path from 'path';
import * as fse from 'fs-extra';
import { SourceResolver } from './SourceResolver.js';
import { TemplateEngine } from './TemplateEngine.js';

interface FileOperation {
  type: 'copy' | 'template' | 'generate';
  source?: string;
  destination: string;
  variables?: string[];
}

interface AppConfig {
  app?: {
    name?: string;
    displayName?: string;
    baseDirectory?: string;
    identifier?: string;
  };
  contentTypes?: Array<{
    name: string;
    plural: string;
    icon?: string;
    directory?: string;
    fields?: Array<{
      name: string;
      type: string;
      required: boolean;
    }>;
    hasViewer?: boolean;
    hasEditor?: boolean;
  }>;
  ui?: {
    preserveFrom?: string;
    theme?: Record<string, any>;
  };
  [key: string]: any; // Allow additional config properties
}

/**
 * Executor for file operations (copy, template, generate)
 */
export class FileOperationsExecutor {
  constructor(
    private sourceResolver: SourceResolver,
    private templateEngine: TemplateEngine
  ) {}

  /**
   * Ensure content ends with a single newline.
   * This prevents inconsistencies when users have different editor settings
   * for "Insert Final Newline" which can create noisy git diffs.
   */
  private ensureFinalNewline(content: string): string {
    if (!content.endsWith('\n')) {
      return content + '\n';
    }
    return content;
  }

  /**
   * Execute a file operation
   */
  async execute(
    operation: FileOperation,
    config: AppConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    switch (operation.type) {
      case 'copy':
        await this.executeCopy(operation, config, sourcePath, targetPath);
        break;
      case 'template':
        await this.executeTemplate(operation, config, sourcePath, targetPath);
        break;
      case 'generate':
        await this.executeGenerate(operation, config, targetPath);
        break;
      default:
        throw new Error(`Unknown operation type: ${(operation as any).type}`);
    }
  }

  /**
   * Execute COPY operation - preserve exact files from source
   */
  private async executeCopy(
    operation: FileOperation,
    config: AppConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    if (!operation.source) {
      throw new Error('COPY operation requires source');
    }

    // Resolve source path (may contain {{sourceReference}} variable)
    const resolvedSource = this.resolvePath(operation.source, { ...config, sourceReference: sourcePath });
    const resolvedDest = this.resolvePath(operation.destination, config);

    // Full paths
    const fullSource = path.isAbsolute(resolvedSource) ? resolvedSource : path.join(sourcePath, resolvedSource);
    const fullDest = path.join(targetPath, resolvedDest);

    // Check source exists
    if (!fs.existsSync(fullSource)) {
      throw new Error(`COPY source does not exist: ${fullSource}`);
    }

    // Ensure destination parent directory exists
    const destDir = path.dirname(fullDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Copy the file/directory
    try {
      await fse.copy(fullSource, fullDest, { overwrite: false, errorOnExist: false });
      console.log(`[FileOperations] Copied: ${operation.source} -> ${operation.destination}`);
    } catch (error) {
      throw new Error(`Failed to copy ${operation.source}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute TEMPLATE operation - generate with variable substitution
   */
  private async executeTemplate(
    operation: FileOperation,
    config: AppConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    if (!operation.source) {
      throw new Error('TEMPLATE operation requires source');
    }

    // Check if this template should iterate over content types
    const shouldIterate = operation.variables?.includes('contentType') && config.contentTypes;

    if (shouldIterate && config.contentTypes) {
      // Generate one file per content type
      for (const contentType of config.contentTypes) {
        await this.generateTemplateFile(
          operation,
          { ...config, contentType, ContentType: this.capitalize(contentType.name) },
          sourcePath,
          targetPath
        );
      }
    } else {
      // Generate single file
      await this.generateTemplateFile(operation, config, sourcePath, targetPath);
    }
  }

  /**
   * Generate a single template file
   */
  private async generateTemplateFile(
    operation: FileOperation,
    config: AppConfig,
    sourcePath: string,
    targetPath: string
  ): Promise<void> {
    if (!operation.source) {
      throw new Error('TEMPLATE operation requires source');
    }

    // Read template file
    const templatePath = path.join(sourcePath, operation.source);
    if (!fs.existsSync(templatePath)) {
      throw new Error(`Template file does not exist: ${templatePath}`);
    }

    const template = fs.readFileSync(templatePath, 'utf-8');

    // Compile template with config variables
    const compiled = this.templateEngine.compile(template, config);

    // Resolve destination path (may contain variables)
    const resolvedDest = this.resolvePath(operation.destination, config);
    const fullDest = path.join(targetPath, resolvedDest);

    // Ensure destination parent directory exists
    const destDir = path.dirname(fullDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    // Write compiled template
    const finalCompiled = this.ensureFinalNewline(compiled);
    fs.writeFileSync(fullDest, finalCompiled, 'utf-8');
    console.log(`[FileOperations] Generated from template: ${operation.source} -> ${resolvedDest}`);
  }

  /**
   * Execute GENERATE operation - AI-powered generation
   */
  private async executeGenerate(
    operation: FileOperation,
    config: AppConfig,
    targetPath: string
  ): Promise<void> {
    // For MVP, log that AI generation is needed
    // In the future, this could call an AI service to generate code based on patterns
    console.log(`[FileOperations] GENERATE operation requested for: ${operation.destination}`);
    console.log(`[FileOperations] AI generation not yet implemented - manual implementation required`);

    // Create a placeholder file
    const resolvedDest = this.resolvePath(operation.destination, config);
    const fullDest = path.join(targetPath, resolvedDest);

    const destDir = path.dirname(fullDest);
    if (!fs.existsSync(destDir)) {
      fs.mkdirSync(destDir, { recursive: true });
    }

    const placeholder = `// TODO: AI-generated code for ${operation.destination}\n// This file needs to be implemented\n`;
    const finalPlaceholder = this.ensureFinalNewline(placeholder);
    fs.writeFileSync(fullDest, finalPlaceholder, 'utf-8');
  }

  /**
   * Resolve a path with variable substitution
   */
  private resolvePath(pathTemplate: string, variables: Record<string, any>): string {
    return this.templateEngine.compilePath(pathTemplate, variables);
  }

  /**
   * Capitalize first letter
   */
  private capitalize(str: string): string {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}
