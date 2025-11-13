import fs from "node:fs/promises";
import path from "node:path";
import type {
  FigmaCaptureOptions,
  FigmaCaptureResult,
  FigmaNodeConfig,
  FigmaNodeEntry,
} from "./types";
import {
  DEFAULT_FIGMA_IMAGE_FORMAT,
  DEFAULT_FIGMA_SCALE,
  FIGMA_OUTPUT_DIR,
  validateFigmaConfig,
} from "./config";
import { fetchFigmaImages, downloadImageBuffer } from "./api";
import { parseNodeId, parseNodeEntryFromUrl, validateNodeId } from "./url-parser";
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
  nodeEntries,
  format = DEFAULT_FIGMA_IMAGE_FORMAT,
  scale = DEFAULT_FIGMA_SCALE,
  outputPath,
  outputDir = FIGMA_OUTPUT_DIR,
}: FigmaCaptureOptions): Promise<FigmaCaptureResult[]> => {
  logger.info("Starting Figma capture process");

  if (!nodeEntries || nodeEntries.length === 0) {
    throw new Error("No node entries provided.");
  }

  const entries = nodeEntries;

  // Deduplicate by fileKey:nodeId combination
  const uniqueEntries = Array.from(
    new Map(entries.map((entry) => [`${entry.fileKey}:${entry.nodeId}`, entry])).values(),
  );
  logger.debug(
    `Unique node entries (${uniqueEntries.length}): ${uniqueEntries.map((e) => `${e.fileKey}/${e.nodeId}`).join(", ")}`,
  );

  if (outputPath && uniqueEntries.length > 1) {
    throw new Error("--output can only be used when capturing a single node.");
  }

  uniqueEntries.forEach((entry) => {
    if (!validateNodeId(entry.nodeId)) {
      throw new Error(`Invalid node ID detected: ${entry.nodeId}`);
    }
  });

  // Group entries by fileKey for batched API calls
  const entriesByFileKey = new Map<string, FigmaNodeEntry[]>();
  for (const entry of uniqueEntries) {
    const existing = entriesByFileKey.get(entry.fileKey) || [];
    existing.push(entry);
    entriesByFileKey.set(entry.fileKey, existing);
  }

  logger.info(
    `Fetching image URLs for ${uniqueEntries.length} node(s) across ${entriesByFileKey.size} file(s) (format: ${format}, scale: ${scale})`,
  );

  // Fetch images for each fileKey
  const imagesByNodeId = new Map<string, { imageUrl: string; fileKey: string }>();
  for (const [currentFileKey, currentEntries] of entriesByFileKey.entries()) {
    logger.debug(`Fetching ${currentEntries.length} node(s) for file key: ${currentFileKey}`);
    const images = await fetchFigmaImages({
      nodeIds: currentEntries.map((e) => e.nodeId),
      fileKey: currentFileKey,
      format,
      scale,
    });

    for (const entry of currentEntries) {
      const imageUrl = images[entry.nodeId];
      if (!imageUrl) {
        logger.error(`No image URL returned for node ${entry.nodeId}`);
        throw new Error(`Figma did not return an image URL for node ${entry.nodeId}`);
      }
      imagesByNodeId.set(entry.nodeId, { imageUrl, fileKey: currentFileKey });
    }
  }

  const timestamp = formatTimestamp();
  const results: FigmaCaptureResult[] = [];

  for (const entry of uniqueEntries) {
    const imageData = imagesByNodeId.get(entry.nodeId);
    if (!imageData) {
      throw new Error(`Missing image data for node ${entry.nodeId}`);
    }

    logger.debug(`Processing node ${entry.nodeId} from file ${entry.fileKey}`);
    const buffer = await downloadImageBuffer(imageData.imageUrl);

    const targetPath =
      outputPath && uniqueEntries.length === 1
        ? path.resolve(process.cwd(), outputPath)
        : buildOutputPath(outputDir, entry.fileKey, entry.nodeId, format, timestamp);

    // ディレクトリが存在しない場合は作成
    const targetDir = path.dirname(targetPath);
    logger.debug(`Ensuring output directory exists: ${targetDir}`);
    await ensureOutputDirectory(targetDir);

    logger.info(`Writing file: ${targetPath}`);
    await fs.writeFile(targetPath, buffer);
    logger.info(`Saved ${entry.nodeId} (${(buffer.length / 1024).toFixed(2)} KB) to ${targetPath}`);

    results.push({
      nodeId: entry.nodeId,
      fileKey: entry.fileKey,
      format,
      scale,
      savedPath: targetPath,
      timestamp,
      imageUrl: imageData.imageUrl,
    });
  }

  logger.info(`Capture completed: ${results.length} file(s) saved`);
  return results;
};

/**
 * Parse node entries from a .txt file.
 * Each line must be either:
 * - A full Figma URL
 * - FILE_KEY#NODE_ID format (e.g., "fl5uK43wSluXQiL7vVHjFq#8802:46326")
 * Lines starting with # are ignored as comments.
 */
const parseNodeEntriesFromTxt = async (filePath: string): Promise<FigmaNodeEntry[]> => {
  const fileContent = await fs.readFile(filePath, "utf8");
  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return lines.map((line, index) => {
    // Check if it's a URL
    try {
      new URL(line);
      const { fileKey, nodeId } = parseNodeEntryFromUrl(line);
      return { fileKey, nodeId };
    } catch {
      // Not a URL, check for FILE_KEY#NODE_ID format
      if (line.includes("#")) {
        const parts = line.split("#");
        if (parts.length === 2 && parts[0] && parts[1]) {
          const fileKey = parts[0].trim();
          const nodeId = parseNodeId(parts[1].trim());
          return { fileKey, nodeId };
        }
      }
      // Invalid format
      throw new Error(
        `Invalid format at line ${index + 1}: "${line}". Expected either a Figma URL or FILE_KEY#NODE_ID format.`,
      );
    }
  });
};

/**
 * Parse node entries from a .json file.
 * Each entry must provide either:
 * - A 'url' field with a full Figma URL
 * - Both 'fileKey' and 'nodeId' fields
 */
const parseNodeEntriesFromJson = async (filePath: string): Promise<FigmaNodeEntry[]> => {
  const fileContent = await fs.readFile(filePath, "utf8");
  const configs: FigmaNodeConfig[] = JSON.parse(fileContent);

  if (!Array.isArray(configs)) {
    throw new Error("JSON file must contain an array of node configurations.");
  }

  return configs.map((config, index) => {
    if (config.url) {
      // Parse from URL
      const { fileKey, nodeId } = parseNodeEntryFromUrl(config.url);
      return { fileKey, nodeId };
    }

    if (config.nodeId) {
      // Require explicit fileKey
      if (!config.fileKey) {
        throw new Error(
          `Entry at index ${index}: 'fileKey' is required when using 'nodeId'. Either provide both 'fileKey' and 'nodeId', or use 'url' instead.`,
        );
      }
      const nodeId = parseNodeId(config.nodeId);
      return { fileKey: config.fileKey, nodeId };
    }

    throw new Error(
      `Entry at index ${index}: must provide either 'url' or both 'fileKey' and 'nodeId'.`,
    );
  });
};

/**
 * Parse node entries from a file (.txt or .json).
 * Returns an array of FigmaNodeEntry with fileKey and nodeId pairs.
 * Each entry must explicitly specify its fileKey (no environment variable fallback).
 */
export const parseNodeEntriesFromFile = async (filePath: string): Promise<FigmaNodeEntry[]> => {
  const resolved = path.resolve(process.cwd(), filePath);
  const ext = path.extname(resolved).toLowerCase();

  if (ext === ".json") {
    logger.debug(`Parsing JSON configuration from ${resolved}`);
    return parseNodeEntriesFromJson(resolved);
  }

  if (ext === ".txt" || !ext) {
    logger.debug(`Parsing TXT configuration from ${resolved}`);
    return parseNodeEntriesFromTxt(resolved);
  }

  throw new Error(`Unsupported file format: ${ext}. Only .txt and .json are supported.`);
};

/**
 * @deprecated Use parseNodeEntriesFromFile instead
 */
export const parseNodeIdsFromFile = async (filePath: string) => {
  const entries = await parseNodeEntriesFromFile(filePath);
  return entries.map((entry) => entry.nodeId);
};

export { parseNodeId, validateNodeId, validateFigmaConfig };
