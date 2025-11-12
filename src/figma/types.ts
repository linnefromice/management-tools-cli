export type FigmaImageFormat = "png" | "jpg";

export type FigmaScale = 1 | 2 | 3 | 4;

export interface FigmaCaptureOptions {
  nodeIds: string[];
  format?: FigmaImageFormat;
  scale?: FigmaScale;
  /**
   * When provided (and only one node is requested) the CLI will write to this path
   * instead of the default `outputs/figma/...` location.
   */
  outputPath?: string;
  /**
   * Optional override for the configured Figma file key.
   */
  fileKey?: string;
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
