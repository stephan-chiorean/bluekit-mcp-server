/**
 * Application configuration schema for blueprint generation
 */

export interface ContentTypeField {
  name: string;
  type: 'string' | 'number' | 'array' | 'object' | 'date' | 'boolean';
  required: boolean;
  description?: string;
}

export interface ContentType {
  name: string;           // Singular (e.g., "podcast")
  plural: string;         // Plural (e.g., "podcasts")
  icon?: string;          // Emoji or icon identifier (e.g., "🎙️")
  directory: string;      // Subdirectory for storage (e.g., "podcasts")
  fields: ContentTypeField[];
  hasViewer?: boolean;    // Whether to generate a viewer component
  hasEditor?: boolean;    // Whether to generate an editor component
}

export interface AppMetadata {
  name: string;           // PascalCase name (e.g., "PodcastLibrary")
  displayName: string;    // Human-readable display name (e.g., "Podcast Library")
  baseDirectory: string;  // Base storage directory (e.g., ".podcasts")
  identifier: string;     // Bundle/app identifier (e.g., "com.myapp.podcast")
  description?: string;   // App description
}

export interface UIConfig {
  preserveFrom?: string;  // Source project path to preserve UI from
  theme?: Record<string, any>; // Custom theme overrides
  primaryColor?: string;  // Primary color (if not using full theme)
  accentColor?: string;   // Accent color
}

export interface AppConfig {
  app: AppMetadata;
  contentTypes: ContentType[];
  ui?: UIConfig;

  // Allow additional custom properties
  [key: string]: any;
}

/**
 * JSON Schema for AppConfig validation
 */
export const AppConfigSchema = {
  $schema: "http://json-schema.org/draft-07/schema#",
  type: "object",
  properties: {
    app: {
      type: "object",
      properties: {
        name: {
          type: "string",
          description: "PascalCase application name (e.g., 'PodcastLibrary')",
          pattern: "^[A-Z][a-zA-Z0-9]*$"
        },
        displayName: {
          type: "string",
          description: "Human-readable display name (e.g., 'Podcast Library')"
        },
        baseDirectory: {
          type: "string",
          description: "Base directory for app storage (e.g., '.podcasts')"
        },
        identifier: {
          type: "string",
          description: "Bundle/app identifier (e.g., 'com.myapp.podcast')",
          pattern: "^[a-z][a-z0-9]*(\\.[a-z][a-z0-9]*)*$"
        },
        description: {
          type: "string",
          description: "Application description"
        }
      },
      required: ["name", "displayName", "baseDirectory", "identifier"]
    },
    contentTypes: {
      type: "array",
      description: "Array of content types to manage",
      items: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Singular name (e.g., 'podcast')"
          },
          plural: {
            type: "string",
            description: "Plural name (e.g., 'podcasts')"
          },
          icon: {
            type: "string",
            description: "Emoji or icon identifier (e.g., '🎙️')"
          },
          directory: {
            type: "string",
            description: "Storage subdirectory (e.g., 'podcasts')"
          },
          fields: {
            type: "array",
            description: "Fields for this content type",
            items: {
              type: "object",
              properties: {
                name: {
                  type: "string",
                  description: "Field name"
                },
                type: {
                  type: "string",
                  enum: ["string", "number", "array", "object", "date", "boolean"],
                  description: "Field data type"
                },
                required: {
                  type: "boolean",
                  description: "Whether this field is required"
                },
                description: {
                  type: "string",
                  description: "Field description"
                }
              },
              required: ["name", "type", "required"]
            }
          },
          hasViewer: {
            type: "boolean",
            description: "Generate viewer component"
          },
          hasEditor: {
            type: "boolean",
            description: "Generate editor component"
          }
        },
        required: ["name", "plural", "directory", "fields"]
      },
      minItems: 1
    },
    ui: {
      type: "object",
      description: "UI configuration",
      properties: {
        preserveFrom: {
          type: "string",
          description: "Source project path to preserve UI components from"
        },
        theme: {
          type: "object",
          description: "Custom theme overrides"
        },
        primaryColor: {
          type: "string",
          description: "Primary color (hex, rgb, or named color)"
        },
        accentColor: {
          type: "string",
          description: "Accent color (hex, rgb, or named color)"
        }
      }
    }
  },
  required: ["app", "contentTypes"],
  additionalProperties: true
};

/**
 * Example AppConfig for a Podcast Library application
 */
export const ExamplePodcastConfig: AppConfig = {
  app: {
    name: "PodcastLibrary",
    displayName: "Podcast Library",
    baseDirectory: ".podcasts",
    identifier: "com.myapp.podcast",
    description: "A desktop application for managing your podcast library"
  },
  contentTypes: [
    {
      name: "podcast",
      plural: "podcasts",
      icon: "🎙️",
      directory: "podcasts",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "description", type: "string", required: false },
        { name: "author", type: "string", required: false },
        { name: "rssUrl", type: "string", required: false },
        { name: "episodes", type: "array", required: false }
      ],
      hasViewer: true,
      hasEditor: true
    },
    {
      name: "episode",
      plural: "episodes",
      icon: "🎧",
      directory: "episodes",
      fields: [
        { name: "title", type: "string", required: true },
        { name: "description", type: "string", required: false },
        { name: "audioUrl", type: "string", required: false },
        { name: "duration", type: "number", required: false },
        { name: "publishedAt", type: "date", required: false }
      ],
      hasViewer: true,
      hasEditor: false
    }
  ],
  ui: {
    primaryColor: "#3182CE",
    accentColor: "#805AD5"
  }
};
