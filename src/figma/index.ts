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
  getFigmaFileKey,
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
  nodeIds,
  format = DEFAULT_FIGMA_IMAGE_FORMAT,
  scale = DEFAULT_FIGMA_SCALE,
  outputPath,
  fileKey,
  outputDir = FIGMA_OUTPUT_DIR,
}: FigmaCaptureOptions): Promise<FigmaCaptureResult[]> => {
  logger.info("Starting Figma capture process");

  // Normalize inputs to FigmaNodeEntry[]
  let entries: FigmaNodeEntry[];
  if (nodeEntries && nodeEntries.length > 0) {
    entries = nodeEntries;
  } else if (nodeIds && nodeIds.length > 0) {
    // Legacy mode: all nodes use the same fileKey
    const fileKeyToUse = fileKey ?? getFigmaFileKey();
    if (!fileKeyToUse) {
      throw new Error("Figma file key is not configured.");
    }
    entries = nodeIds.map((nodeId) => ({ fileKey: fileKeyToUse, nodeId }));
  } else {
    throw new Error("No node IDs supplied.");
  }

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
 * Parse node entries from a .txt file (legacy format).
 * Each line can be a node ID or a Figma URL.
 * Lines starting with # are ignored.
 */
const parseNodeEntriesFromTxt = async (
  filePath: string,
  fallbackFileKey: string,
): Promise<FigmaNodeEntry[]> => {
  const fileContent = await fs.readFile(filePath, "utf8");
  const lines = fileContent
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"));

  return lines.map((line) => {
    // Check if it's a URL
    try {
      new URL(line);
      const { fileKey, nodeId } = parseNodeEntryFromUrl(line);
      return { fileKey, nodeId };
    } catch {
      // Not a URL, treat as node ID
      const nodeId = parseNodeId(line);
      return { fileKey: fallbackFileKey, nodeId };
    }
  });
};

/**
 * Parse node entries from a .json file (new format).
 * Each entry can specify its own fileKey or use a URL.
 */
const parseNodeEntriesFromJson = async (
  filePath: string,
  fallbackFileKey: string,
): Promise<FigmaNodeEntry[]> => {
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
      // Use provided nodeId and fileKey (or fallback)
      const fileKey = config.fileKey || fallbackFileKey;
      if (!fileKey) {
        throw new Error(
          `Entry at index ${index}: fileKey is required when nodeId is specified without a URL.`,
        );
      }
      const nodeId = parseNodeId(config.nodeId);
      return { fileKey, nodeId };
    }

    throw new Error(
      `Entry at index ${index}: must provide either 'url' or 'nodeId' (with optional 'fileKey').`,
    );
  });
};

/**
 * Parse node entries from a file (.txt or .json).
 * Returns an array of FigmaNodeEntry with fileKey and nodeId pairs.
 */
export const parseNodeEntriesFromFile = async (
  filePath: string,
  fallbackFileKey?: string,
): Promise<FigmaNodeEntry[]> => {
  const resolved = path.resolve(process.cwd(), filePath);
  const ext = path.extname(resolved).toLowerCase();

  // Only fallback to env var if no fallbackFileKey is explicitly provided
  const fileKey = fallbackFileKey !== undefined ? fallbackFileKey : getFigmaFileKey();

  if (ext === ".json") {
    logger.debug(`Parsing JSON configuration from ${resolved}`);
    return parseNodeEntriesFromJson(resolved, fileKey);
  }

  if (ext === ".txt" || !ext) {
    if (!fileKey) {
      throw new Error(
        "Figma file key is required for .txt format. Set FIGMA_FILE_KEY or use --file option.",
      );
    }
    logger.debug(`Parsing TXT configuration from ${resolved}`);
    return parseNodeEntriesFromTxt(resolved, fileKey);
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
