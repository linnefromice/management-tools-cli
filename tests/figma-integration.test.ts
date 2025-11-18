import { test, expect, describe } from "bun:test";
import { validateFigmaConfig } from "../packages/core/src/figma";

describe("validateFigmaConfig", () => {
  test("returns validation result", () => {
    const result = validateFigmaConfig({ accessToken: "token" });

    expect(result).toHaveProperty("valid");
    expect(result).toHaveProperty("errors");
    expect(Array.isArray(result.errors)).toBe(true);
  });

  test("includes error messages when config is invalid", () => {
    const result = validateFigmaConfig({});

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
