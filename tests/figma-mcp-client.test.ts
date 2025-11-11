import { test, expect, describe } from "bun:test";
import { decodeBase64Image } from "../src/figma/mcp-client";

describe("decodeBase64Image", () => {
  test("decodes valid base64 image data URL", () => {
    // 1x1 transparent PNG (smallest valid PNG)
    const dataUrl =
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==";
    const buffer = decodeBase64Image(dataUrl);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("decodes JPEG data URL", () => {
    const dataUrl = "data:image/jpeg;base64,/9j/4AAQSkZJRg==";
    const buffer = decodeBase64Image(dataUrl);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("throws on invalid format", () => {
    expect(() => decodeBase64Image("not-a-data-url")).toThrow(
      /Invalid base64 image data URL format/,
    );
  });

  test("throws on missing base64 data", () => {
    expect(() => decodeBase64Image("data:image/png;base64,")).toThrow(
      /Invalid base64 image data URL format/,
    );
  });

  test("throws on malformed data URL", () => {
    expect(() => decodeBase64Image("data:image/png")).toThrow(
      /Invalid base64 image data URL format/,
    );
  });

  test("correctly decodes known base64 string", () => {
    // "Hello" in base64
    const dataUrl = "data:image/png;base64,SGVsbG8=";
    const buffer = decodeBase64Image(dataUrl);
    expect(buffer.toString()).toBe("Hello");
  });
});

// Note: callMcpGetImage の統合テストは実際の MCP Server が必要なため、
// モック版または E2E テストとして別途実装を推奨
// ここではユニットテスト可能な decodeBase64Image のみをテスト
