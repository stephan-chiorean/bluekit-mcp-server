export interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: number | string | null;
  method: string;
  params?: Record<string, unknown>;
}

export interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: number | string | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
  };
}

export interface ToolCallResult {
  content: Array<{ type: 'text'; text: string }>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export type ToolHandler = (params: Record<string, unknown>) => Array<{ type: 'text'; text: string }> | Promise<Array<{ type: 'text'; text: string }>>;

// Blueprint types
export interface BlueprintTask {
  id: string;
  alias: string;
  agent: string;
  kit: string;
}

export interface BlueprintLayer {
  id: string;
  order: number;
  name: string;
  tasks: BlueprintTask[];
}

export interface Blueprint {
  id: string;
  name: string;
  version: number;
  description: string;
  layers: BlueprintLayer[];
}

// Agent types
export interface Agent {
  id: string;
  alias: string;
  type: 'agent';
  version: number;
  description: string;
  tags: string[];
  capabilities: string[];
  executionNotes?: string;
}

