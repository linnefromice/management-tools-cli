import fs from "node:fs/promises";
import path from "node:path";
import type { FigmaCaptureOptions, FigmaCaptureResult } from "./types";
import {
  DEFAULT_FIGMA_IMAGE_FORMAT,
  DEFAULT_FIGMA_SCALE,
  FIGMA_OUTPUT_DIR,
  getFigmaFileKey,
  validateFigmaConfig,
} from "./config";
import { fetchFigmaImages, downloadImageBuffer } from "./api";
import { parseNodeId, validateNodeId } from "./url-parser";
import { logger } from "../logger";

const ensureOutputDirectory = async (dir: string) => {
  await fs.mkdir(dir, { recursive: true });
};

const formatTimestamp = (date = new Date()) => date.toISOString().replace(/[:.]/g, "-");

const hyphenateNodeId = (nodeId: string) => nodeId.replace(/:/g, "-");

const buildOutputPath = (
  dir: string,
  fileKey: string,
  nodeId: string,
  format: string,
  timestamp: string,
) => {
  // 実行単位ごとにタイムスタンプフォルダを作成
  const executionDir = path.join(dir, timestamp);
  const filename = `figma-design-${fileKey}-${hyphenateNodeId(nodeId)}.${format}`;
  return path.join(executionDir, filename);
};

export const captureFigmaNodes = async ({
  nodeIds,
  format = DEFAULT_FIGMA_IMAGE_FORMAT,
  scale = DEFAULT_FIGMA_SCALE,
  outputPath,
  fileKey,
  outputDir = FIGMA_OUTPUT_DIR,
}: FigmaCaptureOptions): Promise<FigmaCaptureResult[]> => {
  logger.info("Starting Figma capture process");

  if (!nodeIds.length) {
    throw new Error("No node IDs supplied.");
  }

  const uniqueNodeIds = Array.from(new Set(nodeIds));
  logger.debug(`Unique node IDs (${uniqueNodeIds.length}): ${uniqueNodeIds.join(", ")}`);

  const fileKeyToUse = fileKey ?? getFigmaFileKey();
  if (!fileKeyToUse) {
    throw new Error("Figma file key is not configured.");
  }
  logger.debug(`Using file key: ${fileKeyToUse}`);

  if (outputPath && uniqueNodeIds.length > 1) {
    throw new Error("--output can only be used when capturing a single node.");
  }

  uniqueNodeIds.forEach((nodeId) => {
    if (!validateNodeId(nodeId)) {
      throw new Error(`Invalid node ID detected: ${nodeId}`);
    }
  });

  logger.info(`Fetching image URLs for ${uniqueNodeIds.length} node(s) (format: ${format}, scale: ${scale})`);
  const images = await fetchFigmaImages({
    nodeIds: uniqueNodeIds,
    fileKey: fileKeyToUse,
    format,
    scale,
  });

  const timestamp = formatTimestamp();
  const results: FigmaCaptureResult[] = [];

  for (const nodeId of uniqueNodeIds) {
    const imageUrl = images[nodeId];
    if (!imageUrl) {
      logger.error(`No image URL returned for node ${nodeId}`);
      throw new Error(`Figma did not return an image URL for node ${nodeId}`);
    }

    logger.debug(`Processing node ${nodeId}`);
    const buffer = await downloadImageBuffer(imageUrl);

    const targetPath =
      outputPath && uniqueNodeIds.length === 1
        ? path.resolve(process.cwd(), outputPath)
        : buildOutputPath(outputDir, fileKeyToUse, nodeId, format, timestamp);

    // ディレクトリが存在しない場合は作成
    const targetDir = path.dirname(targetPath);
    logger.debug(`Ensuring output directory exists: ${targetDir}`);
    await ensureOutputDirectory(targetDir);

    logger.info(`Writing file: ${targetPath}`);
    await fs.writeFile(targetPath, buffer);
    logger.info(`Saved ${nodeId} (${(buffer.length / 1024).toFixed(2)} KB) to ${targetPath}`);

    results.push({
      nodeId,
      fileKey: fileKeyToUse,
      format,
      scale,
      savedPath: targetPath,
      timestamp,
      imageUrl,
    });
  }

  logger.info(`Capture completed: ${results.length} file(s) saved`);
  return results;
};

export const parseNodeIdsFromFile = async (filePath: string) => {
  const resolved = path.resolve(process.cwd(), filePath);
  const fileContent = await fs.readFile(resolved, "utf8");

  return fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => parseNodeId(line));
};

export { parseNodeId, validateNodeId, validateFigmaConfig };
