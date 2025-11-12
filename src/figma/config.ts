import path from "node:path";
import type { FigmaConfigCheck, FigmaImageFormat, FigmaScale } from "./types";

export const getFigmaAccessToken = () => process.env.FIGMA_ACCESS_TOKEN ?? "";
export const getFigmaFileKey = () =>
  process.env.FIGMA_FILE_KEY ?? process.env.FIGMA_PROJECT_KEY ?? "";
export const getFigmaApiBaseUrl = () => process.env.FIGMA_API_BASE_URL ?? "https://api.figma.com";

export const FIGMA_OUTPUT_DIR = path.resolve(process.cwd(), "outputs", "figma");

export const DEFAULT_FIGMA_IMAGE_FORMAT: FigmaImageFormat = "png";
export const DEFAULT_FIGMA_SCALE: FigmaScale = 2;

export const validateFigmaConfig = (): FigmaConfigCheck => {
  const errors: string[] = [];

  if (!getFigmaAccessToken()) {
    errors.push("FIGMA_ACCESS_TOKEN is not set.");
  }

  if (!getFigmaFileKey()) {
    errors.push("FIGMA_FILE_KEY is not set.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
