import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { promises as fs } from "node:fs";
import path from "node:path";
import {
  createFigmaService,
  parseNodeEntriesFromFile,
  validateFigmaConfig,
} from "../packages/core/src/figma";

const ORIGINAL_FETCH = globalThis.fetch;

describe("parseNodeEntriesFromFile", () => {
  const tmpFile = path.resolve("tmp/figma-node-ids.txt");

  beforeEach(async () => {
    await fs.mkdir(path.dirname(tmpFile), { recursive: true });
    await fs.writeFile(
      tmpFile,
      [
        "# onboarding screens",
        "testFileKey#123:456",
        "https://www.figma.com/design/file/slug?node-id=789-012&m=dev",
        "",
        "  ",
      ].join("\n"),
    );
  });

  afterEach(async () => {
    await fs.rm(path.dirname(tmpFile), { recursive: true, force: true });
  });

  test("parses FILE_KEY#NODE_ID and URLs from text file", async () => {
    const entries = await parseNodeEntriesFromFile(tmpFile);
    expect(entries).toEqual([
      { fileKey: "testFileKey", nodeId: "123:456" },
      { fileKey: "file", nodeId: "789:012" },
    ]);
  });
});

describe("captureFigmaNodes", () => {
  const outputDir = path.resolve("tmp/figma-output");
  const figmaService = createFigmaService({ accessToken: "test-token" });

  beforeEach(() => {
    const imageMap = {
      "123:456": "https://figma.example/image-a.png",
      "789:012": "https://figma.example/image-b.png",
    };

    type FetchInput = Parameters<typeof fetch>[0];
    type FetchInit = Parameters<typeof fetch>[1];

    const mockFetch = Object.assign(
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      async (input: FetchInput, _init?: FetchInit) => {
        const url =
          typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;

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
      },
      { preconnect: () => Promise.resolve() },
    );

    globalThis.fetch = mockFetch as typeof fetch;
  });

  afterEach(async () => {
    globalThis.fetch = ORIGINAL_FETCH;
    await fs.rm(outputDir, { recursive: true, force: true });
  });

  test("writes images to disk with default naming", async () => {
    const results = await figmaService.captureNodes({
      nodeEntries: [
        { fileKey: "testFileKey", nodeId: "123:456" },
        { fileKey: "testFileKey", nodeId: "789:012" },
      ],
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

  test("validateFigmaConfig only requires FIGMA_ACCESS_TOKEN", () => {
    const validation = validateFigmaConfig({ accessToken: "test-token" });
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });
});
