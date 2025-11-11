// MCP JSON-RPC リクエスト型
export type McpRequest = {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    tool: "get_image";
    arguments: {
      node_ids: string[];
      format?: "png" | "jpg";
      scale?: number;
    };
  };
};

// MCP JSON-RPC レスポンス型
export type McpResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: {
    format: string;
    node_id: string;
    image: string; // data:image/png;base64,iVBOR...
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

// Figma キャプチャ入力型
export type FigmaCaptureInput = {
  nodeIdOrUrl: string;
  format?: "png" | "jpg";
  scale?: 1 | 2 | 3 | 4;
  outputPath?: string;
};

// Figma キャプチャ結果型
export type FigmaCaptureResult = {
  nodeId: string;
  format: "png" | "jpg";
  savedPath: string;
  source: "mcp-server";
  timestamp: string;
  base64Length: number;
};

// Figma エラー型
export class FigmaMcpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(`Figma MCP Error [${code}]: ${message}`);
    this.name = "FigmaMcpError";
  }
}
