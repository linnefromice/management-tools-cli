const NODE_ID_PATTERN = /^[0-9]+(?::|-)[0-9]+$/;

const isProbablyUrl = (value: string) => {
  try {
    // eslint-disable-next-line no-new
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

export const parseNodeId = (rawInput: string) => {
  const trimmed = rawInput.trim();
  if (!trimmed) {
    throw new Error("Node ID is required.");
  }

  if (isProbablyUrl(trimmed)) {
    const url = new URL(trimmed);
    const nodeIdParam = url.searchParams.get("node-id");

    if (!nodeIdParam) {
      throw new Error("No node-id parameter found in Figma URL.");
    }

    const normalizedFromUrl = normalizeNodeIdValue(nodeIdParam);
    if (!validateNodeId(normalizedFromUrl)) {
      throw new Error("Invalid node-id format in URL.");
    }
    return normalizedFromUrl.replace(/-/g, ":");
  }

  const normalized = normalizeNodeIdValue(trimmed);
  if (!validateNodeId(normalized)) {
    throw new Error("Invalid node ID format.");
  }

  return normalized.replace(/-/g, ":");
};
