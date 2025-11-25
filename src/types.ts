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

export type ToolHandler = (params: Record<string, unknown>) => Array<{ type: 'text'; text: string }>;

