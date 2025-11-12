import { test, expect, describe } from "bun:test";
import {
  parseNodeId,
  validateNodeId,
  parseFileKeyFromUrl,
  parseNodeEntryFromUrl,
} from "../src/figma/url-parser";

describe("parseNodeId", () => {
  test("parses node ID from full Figma URL", () => {
    const url = "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456";
    expect(parseNodeId(url)).toBe("123:456");
  });

  test("handles already decoded node ID", () => {
    expect(parseNodeId("123:456")).toBe("123:456");
  });

  test("handles URL-encoded node ID", () => {
    expect(parseNodeId("123%3A456")).toBe("123:456");
  });

  test("handles dash formatted node ID", () => {
    expect(parseNodeId("123-456")).toBe("123:456");
  });

  test("throws on invalid node ID format", () => {
    expect(() => parseNodeId("invalid")).toThrow(/Invalid node ID format/);
  });

  test("throws on URL without node-id parameter", () => {
    const url = "https://www.figma.com/file/xxxxx/YourProject";
    expect(() => parseNodeId(url)).toThrow(/No node-id parameter found/);
  });

  test("handles complex Figma URLs with multiple parameters", () => {
    const url =
      "https://www.figma.com/file/xxxxx/YourProject?type=design&node-id=789%3A012&mode=dev";
    expect(parseNodeId(url)).toBe("789:012");
  });

  test("throws on malformed node-id in URL", () => {
    const url = "https://www.figma.com/file/xxxxx/YourProject?node-id=invalid-format";
    expect(() => parseNodeId(url)).toThrow(/Invalid node-id format in URL/);
  });
});

describe("validateNodeId", () => {
  test("validates correct node ID", () => {
    expect(validateNodeId("123:456")).toBe(true);
  });

  test("accepts dash separated node ID", () => {
    expect(validateNodeId("123-456")).toBe(true);
  });

  test("rejects text-only input", () => {
    expect(validateNodeId("invalid")).toBe(false);
  });

  test("rejects empty string", () => {
    expect(validateNodeId("")).toBe(false);
  });

  test("rejects single number", () => {
    expect(validateNodeId("123")).toBe(false);
  });
});

describe("parseFileKeyFromUrl", () => {
  test("extracts file key from design URL", () => {
    const url = new URL(
      "https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Master-UI-Design?node-id=7760-56939&m=dev",
    );
    expect(parseFileKeyFromUrl(url)).toBe("fl5uK43wSluXQiL7vVHjFq");
  });

  test("extracts file key from /file/ URL (legacy format)", () => {
    const url = new URL("https://www.figma.com/file/xxxxx/YourProject?node-id=123:456");
    expect(parseFileKeyFromUrl(url)).toBe("xxxxx");
  });

  test("throws on URL without file key", () => {
    const url = new URL("https://www.figma.com/design/");
    expect(() => parseFileKeyFromUrl(url)).toThrow(/Invalid Figma URL format/);
  });

  test("throws on invalid URL path (not /design/ or /file/)", () => {
    const url = new URL("https://www.figma.com/invalid/xxxxx/YourProject");
    expect(() => parseFileKeyFromUrl(url)).toThrow(/Invalid Figma URL format/);
  });
});

describe("parseNodeEntryFromUrl", () => {
  test("extracts both fileKey and nodeId from URL", () => {
    const url =
      "https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Master-UI-Design?node-id=7760-56939&m=dev";
    const result = parseNodeEntryFromUrl(url);
    expect(result.fileKey).toBe("fl5uK43wSluXQiL7vVHjFq");
    expect(result.nodeId).toBe("7760:56939");
  });

  test("handles URL-encoded node-id parameter", () => {
    const url = "https://www.figma.com/design/testFileKey/ProjectName?node-id=123%3A456&mode=dev";
    const result = parseNodeEntryFromUrl(url);
    expect(result.fileKey).toBe("testFileKey");
    expect(result.nodeId).toBe("123:456");
  });

  test("throws on URL without node-id parameter", () => {
    const url = "https://www.figma.com/design/testFileKey/ProjectName";
    expect(() => parseNodeEntryFromUrl(url)).toThrow(/No node-id parameter found/);
  });

  test("throws on URL with invalid node-id format", () => {
    const url = "https://www.figma.com/design/testFileKey/ProjectName?node-id=invalid-format";
    expect(() => parseNodeEntryFromUrl(url)).toThrow(/Invalid node-id format in URL/);
  });
});
