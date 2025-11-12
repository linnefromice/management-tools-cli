import { Buffer } from "node:buffer";
import type { FigmaImageFormat, FigmaImagesResponse, FigmaScale } from "./types";
import {
  DEFAULT_FIGMA_IMAGE_FORMAT,
  DEFAULT_FIGMA_SCALE,
  getFigmaAccessToken,
  getFigmaApiBaseUrl,
} from "./config";
import { logger } from "../logger";

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

  logger.info(`GET ${url.toString()}`);
  logger.debug(`Request headers: X-FIGMA-TOKEN=${accessToken.substring(0, 10)}...`);
  logger.debug(`Requesting ${nodeIds.length} node(s): ${nodeIds.join(", ")}`);

  const startTime = Date.now();
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-FIGMA-TOKEN": accessToken,
    },
  });
  const elapsed = Date.now() - startTime;

  logger.info(`GET ${url.toString()} - ${response.status} ${response.statusText} (${elapsed}ms)`);

  if (!response.ok) {
    const body = await response.text();
    logger.error(`Figma images request failed: ${body}`);
    throw new Error(`Figma images request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as FigmaImagesResponse;
  if (data.err) {
    logger.error(`Figma API error: ${data.err}`);
    throw new Error(`Figma API returned error: ${data.err}`);
  }

  logger.debug(`Received ${Object.keys(data.images).length} image URL(s)`);
  return data.images;
};

export const downloadImageBuffer = async (imageUrl: string) => {
  logger.info(`Downloading image from ${imageUrl}`);

  const startTime = Date.now();
  const response = await fetch(imageUrl);
  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    logger.error(`Image download failed (${response.status}): ${imageUrl}`);
    throw new Error(`Failed to download image (${response.status}): ${imageUrl}`);
  }

  const contentLength = response.headers.get("content-length");
  const sizeInfo = contentLength ? ` (${(Number(contentLength) / 1024).toFixed(2)} KB)` : "";
  logger.info(`Downloaded image${sizeInfo} in ${elapsed}ms`);

  const buffer = await response.arrayBuffer();
  logger.debug(`Converted to buffer: ${buffer.byteLength} bytes`);

  return Buffer.from(buffer);
};
