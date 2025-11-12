import { Buffer } from "node:buffer";
import type { FigmaImageFormat, FigmaImagesResponse, FigmaScale } from "./types";
import {
  DEFAULT_FIGMA_IMAGE_FORMAT,
  DEFAULT_FIGMA_SCALE,
  getFigmaAccessToken,
  getFigmaApiBaseUrl,
} from "./config";

interface FetchImageOptions {
  nodeIds: string[];
  fileKey: string;
  format?: FigmaImageFormat;
  scale?: FigmaScale;
}

const buildImagesUrl = (fileKey: string) => {
  const baseUrl = getFigmaApiBaseUrl();
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/v1/images/${fileKey}`;
};

export const fetchFigmaImages = async ({
  nodeIds,
  fileKey,
  format = DEFAULT_FIGMA_IMAGE_FORMAT,
  scale = DEFAULT_FIGMA_SCALE,
}: FetchImageOptions) => {
  if (!nodeIds.length) {
    throw new Error("At least one node ID must be provided.");
  }

  const accessToken = getFigmaAccessToken();
  if (!accessToken) {
    throw new Error("FIGMA_ACCESS_TOKEN is not configured.");
  }

  const url = new URL(buildImagesUrl(fileKey));
  url.searchParams.set("ids", nodeIds.join(","));
  url.searchParams.set("format", format);
  url.searchParams.set("scale", String(scale));

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-FIGMA-TOKEN": accessToken,
    },
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Figma images request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as FigmaImagesResponse;
  if (data.err) {
    throw new Error(`Figma API returned error: ${data.err}`);
  }

  return data.images;
};

export const downloadImageBuffer = async (imageUrl: string) => {
  const response = await fetch(imageUrl);
  if (!response.ok) {
    throw new Error(`Failed to download image (${response.status}): ${imageUrl}`);
  }

  const buffer = await response.arrayBuffer();
  return Buffer.from(buffer);
};
