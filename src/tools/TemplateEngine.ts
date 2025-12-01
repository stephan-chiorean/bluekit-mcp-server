import Handlebars from 'handlebars';

/**
 * Template engine for generating files with variable substitution
 */
export class TemplateEngine {
  private handlebars: typeof Handlebars;

  constructor() {
    this.handlebars = Handlebars.create();
    this.registerHelpers();
  }

  /**
   * Register custom Handlebars helpers for common transformations
   */
  private registerHelpers(): void {
    // Convert to PascalCase (e.g., "podcast library" -> "PodcastLibrary")
    this.handlebars.registerHelper('pascalCase', (str: string) => {
      if (!str) return '';
      return str
        .split(/[\s-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
    });

    // Convert to camelCase (e.g., "podcast library" -> "podcastLibrary")
    this.handlebars.registerHelper('camelCase', (str: string) => {
      if (!str) return '';
      const pascal = str
        .split(/[\s-_]+/)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join('');
      return pascal.charAt(0).toLowerCase() + pascal.slice(1);
    });

    // Convert to snake_case (e.g., "podcast library" -> "podcast_library")
    this.handlebars.registerHelper('snakeCase', (str: string) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[\s-]+/g, '_');
    });

    // Convert to kebab-case (e.g., "podcast library" -> "podcast-library")
    this.handlebars.registerHelper('kebabCase', (str: string) => {
      if (!str) return '';
      return str
        .toLowerCase()
        .replace(/[\s_]+/g, '-');
    });

    // Convert to UPPER_SNAKE_CASE (e.g., "podcast library" -> "PODCAST_LIBRARY")
    this.handlebars.registerHelper('upperSnakeCase', (str: string) => {
      if (!str) return '';
      return str
        .toUpperCase()
        .replace(/[\s-]+/g, '_');
    });

    // Capitalize first letter (e.g., "podcast" -> "Podcast")
    this.handlebars.registerHelper('capitalize', (str: string) => {
      if (!str) return '';
      return str.charAt(0).toUpperCase() + str.slice(1);
    });

    // Convert to lowercase
    this.handlebars.registerHelper('lowercase', (str: string) => {
      if (!str) return '';
      return str.toLowerCase();
    });

    // Convert to uppercase
    this.handlebars.registerHelper('uppercase', (str: string) => {
      if (!str) return '';
      return str.toUpperCase();
    });

    // Simple pluralize (adds 's' or 'es')
    this.handlebars.registerHelper('pluralize', (str: string) => {
      if (!str) return '';
      if (str.endsWith('s') || str.endsWith('sh') || str.endsWith('ch') || str.endsWith('x') || str.endsWith('z')) {
        return str + 'es';
      }
      if (str.endsWith('y') && !/[aeiou]y$/i.test(str)) {
        return str.slice(0, -1) + 'ies';
      }
      return str + 's';
    });

    // JSON stringify helper
    this.handlebars.registerHelper('json', (context: any) => {
      return JSON.stringify(context, null, 2);
    });

    // Equality check
    this.handlebars.registerHelper('eq', (a: any, b: any) => {
      return a === b;
    });

    // Not equal check
    this.handlebars.registerHelper('ne', (a: any, b: any) => {
      return a !== b;
    });

    // Greater than check
    this.handlebars.registerHelper('gt', (a: any, b: any) => {
      return a > b;
    });

    // Less than check
    this.handlebars.registerHelper('lt', (a: any, b: any) => {
      return a < b;
    });
  }

  /**
   * Compile a template with variables
   * @param template - Handlebars template string
   * @param variables - Variables to substitute
   * @returns Compiled template string
   */
  compile(template: string, variables: Record<string, any>): string {
    try {
      const compiled = this.handlebars.compile(template);
      return compiled(variables);
    } catch (error) {
      throw new Error(`Template compilation failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Compile a template file path with variables
   * Useful for generating dynamic file names like "{{contentType}}Tab.tsx"
   */
  compilePath(pathTemplate: string, variables: Record<string, any>): string {
    return this.compile(pathTemplate, variables);
  }

  /**
   * Register a custom helper
   */
  registerHelper(name: string, fn: Handlebars.HelperDelegate): void {
    this.handlebars.registerHelper(name, fn);
  }
}
