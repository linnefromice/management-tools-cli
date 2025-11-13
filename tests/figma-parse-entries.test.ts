import { test, expect, describe, beforeAll, afterAll } from "bun:test";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { parseNodeEntriesFromFile } from "../src/figma";

describe("parseNodeEntriesFromFile", () => {
  let tmpDir: string;

  beforeAll(async () => {
    tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "figma-test-"));
  });

  afterAll(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  describe("JSON format", () => {
    test("parses JSON with fileKey and nodeId", async () => {
      const jsonPath = path.join(tmpDir, "test-nodes.json");
      await fs.writeFile(
        jsonPath,
        JSON.stringify([
          { fileKey: "fileKey1", nodeId: "123:456" },
          { fileKey: "fileKey2", nodeId: "789:012" },
        ]),
      );

      const result = await parseNodeEntriesFromFile(jsonPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("parses JSON with URLs", async () => {
      const jsonPath = path.join(tmpDir, "test-urls.json");
      await fs.writeFile(
        jsonPath,
        JSON.stringify([
          {
            url: "https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Master-UI-Design?node-id=7760-56939&m=dev",
          },
        ]),
      );

      const result = await parseNodeEntriesFromFile(jsonPath);
      expect(result).toEqual([{ fileKey: "fl5uK43wSluXQiL7vVHjFq", nodeId: "7760:56939" }]);
    });

    test("parses JSON with mixed URL and nodeId", async () => {
      const jsonPath = path.join(tmpDir, "test-mixed.json");
      await fs.writeFile(
        jsonPath,
        JSON.stringify([
          { fileKey: "fileKey1", nodeId: "123:456" },
          {
            url: "https://www.figma.com/design/fileKey2/Project?node-id=789-012",
          },
        ]),
      );

      const result = await parseNodeEntriesFromFile(jsonPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("throws on invalid JSON array", async () => {
      const jsonPath = path.join(tmpDir, "test-invalid.json");
      await fs.writeFile(jsonPath, JSON.stringify({ invalid: "object" }));

      await expect(parseNodeEntriesFromFile(jsonPath)).rejects.toThrow(/must contain an array/);
    });

    test("throws on entry without url or nodeId", async () => {
      const jsonPath = path.join(tmpDir, "test-missing.json");
      await fs.writeFile(jsonPath, JSON.stringify([{ fileKey: "fileKey1" }]));

      await expect(parseNodeEntriesFromFile(jsonPath)).rejects.toThrow(
        /must provide either 'url' or both 'fileKey' and 'nodeId'/,
      );
    });

    test("throws when nodeId is specified without fileKey", async () => {
      const jsonPath = path.join(tmpDir, "test-no-filekey.json");
      await fs.writeFile(jsonPath, JSON.stringify([{ nodeId: "123:456" }]));

      await expect(parseNodeEntriesFromFile(jsonPath)).rejects.toThrow(
        /'fileKey' is required when using 'nodeId'/,
      );
    });
  });

  describe("TXT format", () => {
    test("parses TXT with FILE_KEY#NODE_ID format", async () => {
      const txtPath = path.join(tmpDir, "test-nodes.txt");
      await fs.writeFile(txtPath, "fileKey1#123:456\nfileKey2#789:012");

      const result = await parseNodeEntriesFromFile(txtPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("parses TXT with URLs and extracts fileKey from URL", async () => {
      const txtPath = path.join(tmpDir, "test-urls.txt");
      await fs.writeFile(
        txtPath,
        "https://www.figma.com/design/fileKey1/Project?node-id=123-456\nhttps://www.figma.com/design/fileKey2/Project?node-id=789-012",
      );

      const result = await parseNodeEntriesFromFile(txtPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("parses TXT with mixed URLs and FILE_KEY#NODE_ID", async () => {
      const txtPath = path.join(tmpDir, "test-mixed.txt");
      await fs.writeFile(
        txtPath,
        "fileKey1#123:456\nhttps://www.figma.com/design/fileKey2/Project?node-id=789-012",
      );

      const result = await parseNodeEntriesFromFile(txtPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("ignores comments and empty lines", async () => {
      const txtPath = path.join(tmpDir, "test-comments.txt");
      await fs.writeFile(
        txtPath,
        "# Comment\nfileKey1#123:456\n\nfileKey2#789:012\n# Another comment",
      );

      const result = await parseNodeEntriesFromFile(txtPath);
      expect(result).toEqual([
        { fileKey: "fileKey1", nodeId: "123:456" },
        { fileKey: "fileKey2", nodeId: "789:012" },
      ]);
    });

    test("throws when node ID is provided without fileKey (no # separator)", async () => {
      const txtPath = path.join(tmpDir, "test-no-filekey.txt");
      await fs.writeFile(txtPath, "123:456");

      await expect(parseNodeEntriesFromFile(txtPath)).rejects.toThrow(
        /Invalid format.*Expected either a Figma URL or FILE_KEY#NODE_ID format/,
      );
    });

    test("normalizes dash format in FILE_KEY#NODE_ID", async () => {
      const txtPath = path.join(tmpDir, "test-dash-format.txt");
      await fs.writeFile(txtPath, "fileKey1#123-456");

      const result = await parseNodeEntriesFromFile(txtPath);
      expect(result).toEqual([{ fileKey: "fileKey1", nodeId: "123:456" }]);
    });
  });

  describe("File extension handling", () => {
    test("throws on unsupported file extension", async () => {
      const xmlPath = path.join(tmpDir, "test.xml");
      await fs.writeFile(xmlPath, "<nodes></nodes>");

      await expect(parseNodeEntriesFromFile(xmlPath)).rejects.toThrow(/Unsupported file format/);
    });

    test("treats files without extension as TXT and requires FILE_KEY#NODE_ID format", async () => {
      const noExtPath = path.join(tmpDir, "test-no-ext");
      await fs.writeFile(noExtPath, "fileKey1#123:456");

      const result = await parseNodeEntriesFromFile(noExtPath);
      expect(result).toEqual([{ fileKey: "fileKey1", nodeId: "123:456" }]);
    });
  });
});
