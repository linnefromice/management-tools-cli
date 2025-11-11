import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseNodeId } from "./figma/url-parser";
import { callMcpGetImage, decodeBase64Image } from "./figma/mcp-client";
import type { FigmaCaptureInput, FigmaCaptureResult } from "./figma/types";
import { FIGMA_MCP_ENDPOINT } from "./constants";

/**
 * デフォルト出力パスの生成
 */
const buildDefaultFigmaOutputPath = (nodeId: string, format: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sanitizedNodeId = nodeId.replace(/:/g, "-");
  const dir = path.resolve(process.cwd(), "storage", "figma");
  return path.join(dir, `${sanitizedNodeId}-${timestamp}.${format}`);
};

/**
 * Figma キャプチャのメイン処理
 */
export const captureFigmaNode = async (
  input: FigmaCaptureInput,
): Promise<FigmaCaptureResult> => {
  // 1. ノードIDの正規化
  const nodeId = parseNodeId(input.nodeIdOrUrl);
  const format = input.format ?? "png";
  const scale = input.scale ?? 2;

  // 2. MCP Server へリクエスト
  const mcpResult = await callMcpGetImage(FIGMA_MCP_ENDPOINT, [nodeId], {
    format,
    scale,
  });

  // 3. Base64 画像データのデコード
  const imageBuffer = decodeBase64Image(mcpResult.base64Image);

  // 4. ファイル保存
  const outputPath = input.outputPath
    ? path.resolve(process.cwd(), input.outputPath)
    : buildDefaultFigmaOutputPath(nodeId, format);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, imageBuffer);

  // 5. 結果の返却
  return {
    nodeId: mcpResult.nodeId,
    format: format,
    savedPath: outputPath,
    source: "mcp-server",
    timestamp: new Date().toISOString(),
    base64Length: mcpResult.base64Image.length,
  };
};

/**
 * 設定の検証（起動時チェック用）
 */
export const validateFigmaConfig = (): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!FIGMA_MCP_ENDPOINT) {
    errors.push("FIGMA_MCP_ENDPOINT is not configured.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
