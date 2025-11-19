import { Buffer } from "node:buffer";
import type { CoreLogger } from "../types";
import type { FigmaImageFormat, FigmaImagesResponse, FigmaScale } from "./types";
import { DEFAULT_FIGMA_IMAGE_FORMAT, DEFAULT_FIGMA_SCALE } from "./config";

interface FetchImageOptions {
  nodeIds: string[];
  fileKey: string;
  format?: FigmaImageFormat;
  scale?: FigmaScale;
}

export type FigmaApiContext = {
  accessToken: string;
  apiBaseUrl: string;
  logger?: CoreLogger;
};

const log = (logger: CoreLogger | undefined, level: keyof CoreLogger, message: string) => {
  if (!logger) return;
  logger[level](message);
};

const buildImagesUrl = (ctx: FigmaApiContext, fileKey: string) => {
  const baseUrl = ctx.apiBaseUrl;
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return `${base}/v1/images/${fileKey}`;
};

export const fetchFigmaImages = async (
  ctx: FigmaApiContext,
  {
    nodeIds,
    fileKey,
    format = DEFAULT_FIGMA_IMAGE_FORMAT,
    scale = DEFAULT_FIGMA_SCALE,
  }: FetchImageOptions,
) => {
  if (!nodeIds.length) {
    throw new Error("At least one node ID must be provided.");
  }

  const url = new URL(buildImagesUrl(ctx, fileKey));
  url.searchParams.set("ids", nodeIds.join(","));
  url.searchParams.set("format", format);
  url.searchParams.set("scale", String(scale));

  log(ctx.logger, "info", `GET ${url.toString()}`);
  log(
    ctx.logger,
    "debug",
    `Request headers: X-FIGMA-TOKEN=${ctx.accessToken.substring(0, 10)}...`,
  );
  log(ctx.logger, "debug", `Requesting ${nodeIds.length} node(s): ${nodeIds.join(", ")}`);

  const startTime = Date.now();
  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "X-FIGMA-TOKEN": ctx.accessToken,
    },
  });
  const elapsed = Date.now() - startTime;

  log(
    ctx.logger,
    "info",
    `GET ${url.toString()} - ${response.status} ${response.statusText} (${elapsed}ms)`,
  );

  if (!response.ok) {
    const body = await response.text();
    log(ctx.logger, "error", `Figma images request failed: ${body}`);
    throw new Error(`Figma images request failed (${response.status}): ${body}`);
  }

  const data = (await response.json()) as FigmaImagesResponse;
  if (data.err) {
    log(ctx.logger, "error", `Figma API error: ${data.err}`);
    throw new Error(`Figma API returned error: ${data.err}`);
  }

  log(ctx.logger, "debug", `Received ${Object.keys(data.images).length} image URL(s)`);
  return data.images;
};

export const downloadImageBuffer = async (ctx: FigmaApiContext, imageUrl: string) => {
  log(ctx.logger, "info", `Downloading image from ${imageUrl}`);

  const startTime = Date.now();
  const response = await fetch(imageUrl);
  const elapsed = Date.now() - startTime;

  if (!response.ok) {
    log(ctx.logger, "error", `Image download failed (${response.status}): ${imageUrl}`);
    throw new Error(`Failed to download image (${response.status}): ${imageUrl}`);
  }

  const contentLength = response.headers.get("content-length");
  const sizeInfo = contentLength ? ` (${(Number(contentLength) / 1024).toFixed(2)} KB)` : "";
  log(ctx.logger, "info", `Downloaded image${sizeInfo} in ${elapsed}ms`);

  const buffer = await response.arrayBuffer();
  log(ctx.logger, "debug", `Converted to buffer: ${buffer.byteLength} bytes`);

  return Buffer.from(buffer);
};
