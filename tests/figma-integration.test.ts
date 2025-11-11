import { test, expect, describe } from "bun:test";
import { captureFigmaNode, validateFigmaConfig } from "../src/figma";
import { readFile, unlink } from "node:fs/promises";

// Note: このテストは実際の Figma MCP Server が起動している必要がある
// CI 環境では skip するか、モックサーバーを用意する

describe.skip("Figma Integration Tests (requires running MCP server)", () => {
  const testNodeId = "123:456"; // 実際のテスト用ノードIDに置き換え

  test("captures Figma node and saves to file", async () => {
    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      format: "png",
      scale: 1,
    });

    expect(result.nodeId).toBe(testNodeId);
    expect(result.format).toBe("png");
    expect(result.savedPath).toMatch(/\.png$/);
    expect(result.source).toBe("mcp-server");
    expect(result.timestamp).toBeTruthy();

    // ファイルが実際に存在し、サイズが0より大きいことを確認
    const fileBuffer = await readFile(result.savedPath);
    expect(fileBuffer.length).toBeGreaterThan(0);

    // テスト後のクリーンアップ
    await unlink(result.savedPath);
  }, 30000); // 30秒のタイムアウト

  test("handles custom output path", async () => {
    const customPath = "./test-capture.png";

    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      outputPath: customPath,
    });

    expect(result.savedPath).toContain("test-capture.png");

    // ファイルが存在することを確認
    const fileBuffer = await readFile(result.savedPath);
    expect(fileBuffer.length).toBeGreaterThan(0);

    // クリーンアップ
    await unlink(result.savedPath);
  }, 30000);

  test("handles JPG format", async () => {
    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      format: "jpg",
      scale: 1,
    });

    expect(result.format).toBe("jpg");
    expect(result.savedPath).toMatch(/\.jpg$/);

    // クリーンアップ
    await unlink(result.savedPath);
  }, 30000);

  test("handles different scale factors", async () => {
    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      scale: 4,
    });

    expect(result.nodeId).toBe(testNodeId);

    // クリーンアップ
    await unlink(result.savedPath);
  }, 30000);
});

describe("validateFigmaConfig", () => {
  test("returns validation result", () => {
    const result = validateFigmaConfig();

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test("includes error messages when config is invalid", () => {
    const result = validateFigmaConfig();

    // デフォルト設定では無効な場合、エラーがあるはず
    if (!result.valid) {
      expect(result.errors.length).toBeGreaterThan(0);
      result.errors.forEach((error) => {
        expect(typeof error).toBe("string");
        expect(error.length).toBeGreaterThan(0);
      });
    }
  });
});
