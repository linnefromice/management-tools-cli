import { describe, expect, test, spyOn } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { arrayToCsv, printPayload, normalizeFormat, writePayload } from "../src/output";

describe("normalizeFormat", () => {
  test("defaults to json", () => {
    expect(normalizeFormat(undefined)).toBe("json");
    expect(normalizeFormat("JSON")).toBe("json");
  });

  test("accepts csv", () => {
    expect(normalizeFormat("csv")).toBe("csv");
  });
});

describe("arrayToCsv", () => {
  test("converts multiple rows", () => {
    const csv = arrayToCsv([
      { id: "1", name: "Alpha" },
      { id: "2", name: "Beta" },
    ]);
    expect(csv).toContain("id,name");
    expect(csv).toContain("1,Alpha");
    expect(csv).toContain("2,Beta");
  });
});

describe("printPayload", () => {
  test("prints JSON when format is json", () => {
    const spy = spyOn(console, "log");
    printPayload({ hello: "world" }, "json");
    expect(spy).toHaveBeenCalledWith(JSON.stringify({ hello: "world" }, null, 2));
    spy.mockRestore();
  });

  test("prints CSV when format is csv", () => {
    const spy = spyOn(console, "log");
    printPayload({ items: [{ id: 1, name: "Item" }] }, "csv", { collectionKey: "items" });
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});

describe("writePayload", () => {
  test("writes payload to disk", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "cli-output-"));
    const target = path.join(dir, "data.csv");
    await writePayload({ rows: [{ id: 1 }] }, "csv", { collectionKey: "rows" }, target);
    const content = await readFile(target, "utf-8");
    expect(content).toContain("id");
  });
});
