import { describe, expect, test, spyOn } from "bun:test";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  arrayToCsv,
  printPayload,
  normalizeFormat,
  renderPayload,
  writePayload,
} from "../packages/cli/src/output";

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

describe("analytics field filtering", () => {
  test("filters json payload down to analytics fields", () => {
    const payload = {
      issues: [
        {
          id: "issue-1",
          identifier: "CORE-1",
          title: "Fix bug",
          description: "details",
          projectId: "project-1",
        },
      ],
    };

    const rendered = renderPayload(payload, "json", { collectionKey: "issues" });
    const parsed = JSON.parse(rendered) as { issues: Array<Record<string, unknown>> };

    expect(parsed.issues[0]).toEqual({
      identifier: "CORE-1",
      title: "Fix bug",
      description: "details",
    });
  });

  test("filters csv payload headers", () => {
    const payload = {
      issues: [
        {
          id: "issue-1",
          identifier: "CORE-1",
          title: "Fix bug",
          description: "details",
          projectId: "project-1",
        },
      ],
    };

    const rendered = renderPayload(payload, "csv", { collectionKey: "issues" });
    const [headerLine = ""] = rendered.split("\n");

    expect(headerLine).not.toBe("");
    expect(headerLine.split(",")).toEqual(["identifier", "title", "description"]);
    expect(rendered.includes("project-1")).toBe(false);
    expect(rendered.includes("issue-1")).toBe(false);
  });

  test("can skip filtering for json via option", () => {
    const payload = {
      issues: [
        {
          id: "issue-raw",
          identifier: "RAW-1",
          title: "Raw issue",
          projectId: "project-raw",
        },
      ],
    };

    const rendered = renderPayload(payload, "json", {
      collectionKey: "issues",
      skipAnalyticsFilter: true,
    });
    const parsed = JSON.parse(rendered) as { issues: Array<Record<string, unknown>> };

    expect(parsed.issues[0]).toMatchObject({
      id: "issue-raw",
      identifier: "RAW-1",
      projectId: "project-raw",
    });
  });

  test("can skip filtering for csv via option", () => {
    const payload = {
      issues: [
        {
          id: "issue-raw",
          identifier: "RAW-1",
          title: "Raw issue",
        },
      ],
    };

    const rendered = renderPayload(payload, "csv", {
      collectionKey: "issues",
      skipAnalyticsFilter: true,
    });

    expect(rendered.startsWith("id,identifier,title")).toBe(true);
    expect(rendered.includes("issue-raw")).toBe(true);
  });

  test("filters projects payload to include id and issueCount", () => {
    const payload = {
      projects: [
        {
          id: "proj-123",
          name: "Test Project",
          state: "started",
          description: "A test project",
          issueCount: 42,
          internalField: "should-be-filtered",
        },
      ],
    };

    const rendered = renderPayload(payload, "json", { collectionKey: "projects" });
    const parsed = JSON.parse(rendered) as { projects: Array<Record<string, unknown>> };

    expect(parsed.projects[0]).toMatchObject({
      id: "proj-123",
      name: "Test Project",
      state: "started",
      description: "A test project",
      issueCount: 42,
    });
    expect(parsed.projects[0].internalField).toBeUndefined();
  });

  test("filters projects csv to include id and issueCount headers", () => {
    const payload = {
      projects: [
        {
          id: "proj-456",
          name: "CSV Project",
          state: "backlog",
          issueCount: 10,
          internalField: "filtered",
        },
      ],
    };

    const rendered = renderPayload(payload, "csv", { collectionKey: "projects" });
    const [headerLine = ""] = rendered.split("\n");

    expect(headerLine).toContain("id");
    expect(headerLine).toContain("name");
    expect(headerLine).toContain("state");
    expect(headerLine).toContain("issueCount");
    expect(headerLine).not.toContain("internalField");
    expect(rendered).toContain("proj-456");
    expect(rendered).toContain("CSV Project");
    expect(rendered).toContain("10");
  });
});
