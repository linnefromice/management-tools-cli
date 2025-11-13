export type FigmaImageFormat = "png" | "jpg";

export type FigmaScale = 1 | 2 | 3 | 4;

export interface FigmaCaptureOptions {
  /**
   * Node entries with fileKey and nodeId pairs.
   * Each entry must explicitly specify both fileKey and nodeId.
   */
  nodeEntries: FigmaNodeEntry[];
  format?: FigmaImageFormat;
  scale?: FigmaScale;
  /**
   * When provided (and only one node is requested) the CLI will write to this path
   * instead of the default `outputs/figma/...` location.
   */
  outputPath?: string;
  /**
   * Override for the base output directory. Defaults to `outputs/figma`.
   */
  outputDir?: string;
}

export interface FigmaCaptureResult {
  nodeId: string;
  fileKey: string;
  format: FigmaImageFormat;
  scale: FigmaScale;
  savedPath: string;
  timestamp: string;
  imageUrl: string;
}

export interface FigmaConfigCheck {
  valid: boolean;
  errors: string[];
}

export interface FigmaImagesResponse {
  err: string | null;
  images: Record<string, string | null>;
}

/**
 * Represents a Figma node with its file key.
 * Used for JSON-based configuration where each node can have its own file key.
 */
export interface FigmaNodeConfig {
  /**
   * The Figma file key (required if nodeId is provided)
   */
  fileKey?: string;
  /**
   * The node ID (e.g., "8802:46326")
   */
  nodeId?: string;
  /**
   * A full Figma URL (alternative to fileKey + nodeId)
   */
  url?: string;
}

/**
 * Represents a parsed node entry with both fileKey and nodeId resolved.
 */
export interface FigmaNodeEntry {
  fileKey: string;
  nodeId: string;
}
