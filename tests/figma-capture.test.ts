import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  captureFigmaNodes,
  parseNodeIdsFromFile,
  validateFigmaConfig,
} from "../src/figma";

const ORIGINAL_ENV = {
  FIGMA_FILE_KEY: process.env.FIGMA_FILE_KEY,
  FIGMA_ACCESS_TOKEN: process.env.FIGMA_ACCESS_TOKEN,
};

const ORIGINAL_FETCH = globalThis.fetch;

const resetEnv = () => {
  if (ORIGINAL_ENV.FIGMA_FILE_KEY === undefined) {
    delete process.env.FIGMA_FILE_KEY;
  } else {
    process.env.FIGMA_FILE_KEY = ORIGINAL_ENV.FIGMA_FILE_KEY;
  }

  if (ORIGINAL_ENV.FIGMA_ACCESS_TOKEN === undefined) {
    delete process.env.FIGMA_ACCESS_TOKEN;
  } else {
    process.env.FIGMA_ACCESS_TOKEN = ORIGINAL_ENV.FIGMA_ACCESS_TOKEN;
  }
};

describe("parseNodeIdsFromFile", () => {
  const tmpFile = path.resolve("tmp/figma-node-ids.txt");

  beforeEach(async () => {
    await fs.mkdir(path.dirname(tmpFile), { recursive: true });
    await fs.writeFile(
      tmpFile,
      [
        "# onboarding screens",
        "123:456",
        "https://www.figma.com/design/file/slug?node-id=789-012&m=dev",
        "",
        "  ",
      ].join("\n"),
    );
  });

  afterEach(async () => {
    await fs.rm(path.dirname(tmpFile), { recursive: true, force: true });
  });

  test("parses IDs and URLs from text file", async () => {
    const ids = await parseNodeIdsFromFile(tmpFile);
    expect(ids).toEqual(["123:456", "789:012"]);
  });
});

describe("captureFigmaNodes", () => {
  const outputDir = path.resolve("tmp/figma-output");

  beforeEach(() => {
    process.env.FIGMA_FILE_KEY = "testFileKey";
    process.env.FIGMA_ACCESS_TOKEN = "test-token";

    const imageMap = {
      "123:456": "https://figma.example/image-a.png",
      "789:012": "https://figma.example/image-b.png",
    };

    globalThis.fetch = async (input: RequestInfo | URL) => {
      const url =
        typeof input === "string"
          ? input
          : input instanceof URL
          ? input.toString()
          : input.url;

      if (url.includes("/v1/images/")) {
        return new Response(
          JSON.stringify({
            err: null,
            images: imageMap,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.startsWith("https://figma.example/")) {
        return new Response("fake-binary", { status: 200 });
      }

      return new Response("not found", { status: 404 });
    };
  });

  afterEach(async () => {
    resetEnv();
    globalThis.fetch = ORIGINAL_FETCH;
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  test("writes images to disk with default naming", async () => {
    const results = await captureFigmaNodes({
      nodeIds: ["123:456", "789:012"],
      format: "png",
      scale: 2,
      outputDir,
    });

    expect(results).toHaveLength(2);
    for (const result of results) {
      const exists = await fs.readFile(result.savedPath);
      expect(exists.length).toBeGreaterThan(0);
      expect(result.savedPath.startsWith(outputDir)).toBe(true);
      expect(result.savedPath.endsWith(".png")).toBe(true);
      expect(result.fileKey).toBe("testFileKey");
    }
  });

  test("validateFigmaConfig reflects env state", () => {
    const validation = validateFigmaConfig();
    expect(validation.valid).toBe(true);
  });
});
