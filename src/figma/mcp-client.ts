import type { McpRequest, McpResponse } from "./types";
import { FigmaMcpError } from "./types";

/**
 * MCP Server へ JSON-RPC リクエストを送信
 */
export const callMcpGetImage = async (
  endpoint: string,
  nodeIds: string[],
  options?: {
    format?: "png" | "jpg";
    scale?: number;
  },
): Promise<{ nodeId: string; format: string; base64Image: string }> => {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      tool: "get_image",
      arguments: {
        node_ids: nodeIds,
        format: options?.format ?? "png",
        scale: options?.scale ?? 2,
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to Figma MCP Server at ${endpoint}. ` +
        `Ensure @figma/mcp-server is running. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `MCP Server returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  let data: McpResponse;
  try {
    data = (await response.json()) as McpResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse MCP Server response as JSON. ` +
        `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // MCP エラーレスポンスの処理
  if (data.error) {
    throw new FigmaMcpError(data.error.code, data.error.message, data.error.data);
  }

  // 結果の検証
  if (!data.result || !data.result.image) {
    throw new Error(
      `MCP Server returned invalid response: missing result or image data`,
    );
  }

  return {
    nodeId: data.result.node_id,
    format: data.result.format,
    base64Image: data.result.image,
  };
};

/**
 * Base64 画像データから実際の画像バイナリを抽出
 *
 * 入力: "data:image/png;base64,iVBORw0KGgoAAAA..."
 * 出力: バイナリバッファ
 */
export const decodeBase64Image = (dataUrl: string): Buffer => {
  const match = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl);

  if (!match || !match[1]) {
    throw new Error(
      `Invalid base64 image data URL format. Expected "data:image/*;base64,..."`,
    );
  }

  const base64Data = match[1];
  return Buffer.from(base64Data, "base64");
};
