import path from "node:path";
import type {
  FigmaConfigCheck,
  FigmaImageFormat,
  FigmaScale,
  FigmaServiceConfig,
} from "./types";

export const DEFAULT_FIGMA_IMAGE_FORMAT: FigmaImageFormat = "png";
export const DEFAULT_FIGMA_SCALE: FigmaScale = 2;
export const DEFAULT_FIGMA_API_BASE_URL = "https://api.figma.com";

export const resolveFigmaOutputDir = (custom?: string) =>
  custom ?? path.resolve(process.cwd(), "outputs", "figma");

export const normalizeFigmaConfig = (config: FigmaServiceConfig) => ({
  accessToken: config.accessToken,
  apiBaseUrl: config.apiBaseUrl ?? DEFAULT_FIGMA_API_BASE_URL,
  outputDir: resolveFigmaOutputDir(config.outputDir),
  logger: config.logger,
});

export const validateFigmaConfig = (config: Partial<FigmaServiceConfig>): FigmaConfigCheck => {
  const errors: string[] = [];

  if (!config.accessToken) {
    errors.push("Figma access token is missing.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
