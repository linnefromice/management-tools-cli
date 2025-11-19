const NODE_ID_PATTERN = /^[0-9]+(?::|-)[0-9]+$/;

const isProbablyUrl = (value: string) => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const normalizeNodeIdValue = (value: string) => {
  const decoded = decodeURIComponent(value.trim());

  if (!decoded) {
    throw new Error("Node ID value is empty.");
  }

  let normalized = decoded.replace(/\s+/g, "");
  if (!normalized.includes(":") && normalized.includes("-")) {
    const [head, ...rest] = normalized.split("-");
    if (rest.length > 0) {
      normalized = `${head}:${rest.join("-")}`;
    }
  }

  return normalized;
};

export const validateNodeId = (value: string) => NODE_ID_PATTERN.test(value);

/**
 * Extracts the file key from a Figma URL.
 * Expected format: https://www.figma.com/design/{fileKey}/... or https://www.figma.com/file/{fileKey}/...
 */
export const parseFileKeyFromUrl = (url: URL): string => {
  const pathParts = url.pathname.split("/").filter(Boolean);
  // Expected: ["design" or "file", fileKey, ...]
  if (pathParts.length < 2) {
    throw new Error(
      "Invalid Figma URL format. Expected: /design/{fileKey}/... or /file/{fileKey}/...",
    );
  }
  const firstPart = pathParts[0];
  if (firstPart !== "design" && firstPart !== "file") {
    throw new Error(
      "Invalid Figma URL format. Expected: /design/{fileKey}/... or /file/{fileKey}/...",
    );
  }
  const fileKey = pathParts[1];
  if (!fileKey) {
    throw new Error("Could not extract file key from Figma URL.");
  }
  return fileKey;
};

/**
 * Parses a Figma URL to extract both fileKey and nodeId.
 */
export const parseNodeEntryFromUrl = (rawUrl: string): { fileKey: string; nodeId: string } => {
  const url = new URL(rawUrl);
  const nodeIdParam = url.searchParams.get("node-id");

  if (!nodeIdParam) {
    throw new Error("No node-id parameter found in Figma URL.");
  }

  const normalizedNodeId = normalizeNodeIdValue(nodeIdParam);
  if (!validateNodeId(normalizedNodeId)) {
    throw new Error("Invalid node-id format in URL.");
  }

  const fileKey = parseFileKeyFromUrl(url);
  const nodeId = normalizedNodeId.replace(/-/g, ":");

  return { fileKey, nodeId };
};

export const parseNodeId = (rawInput: string) => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error("Node ID is required.");
  }

  if (isProbablyUrl(trimmed)) {
    const { nodeId } = parseNodeEntryFromUrl(trimmed);
    return nodeId;
  }

  const normalized = normalizeNodeIdValue(trimmed);
  if (!validateNodeId(normalized)) {
    throw new Error("Invalid node ID format.");
  }

  return normalized.replace(/-/g, ":");
};
