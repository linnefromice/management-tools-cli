import { test, expect, describe } from "bun:test";
import { parseNodeId, validateNodeId } from "../src/figma/url-parser";

describe("parseNodeId", () => {
  test("parses node ID from full Figma URL", () => {
    const url =
      "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456";
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
    const url =
      "https://www.figma.com/file/xxxxx/YourProject?node-id=invalid-format";
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
