import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLinearStorage, type LinearStorage } from "../packages/core/src/storage";
import type { LinearIssueFull } from "../packages/core/src/linear";

let tempDir: string;
let storage: LinearStorage;

const issues: LinearIssueFull[] = [
  {
    id: "issue-1",
    projectId: "project-alpha",
    labelIds: ["label-bug", "label-ui"],
    cycleId: "cycle-1",
    number: 1,
    teamId: "team-core",
  },
  {
    id: "issue-2",
    projectId: "project-beta",
    labelIds: ["label-feature"],
    cycleId: "cycle-2",
    number: 2,
    teamId: "team-biz",
  },
];

beforeEach(async () => {
  tempDir = await mkdtemp(path.join(tmpdir(), "linear-storage-"));
  storage = createLinearStorage({ rootDir: tempDir });

  await storage.writeLinearDataset("issues", {
    fetchedAt: new Date().toISOString(),
    count: issues.length,
    items: issues,
  });

  await storage.writeLinearDataset("teams", {
    fetchedAt: new Date().toISOString(),
    count: 2,
    items: [
      { id: "team-core", key: "CORE" },
      { id: "team-biz", key: "BIZ" },
    ],
  });
});

afterEach(async () => {
  await rm(tempDir, { recursive: true, force: true });
});

describe("searchStoredIssues", () => {
  test("returns all issues when no filters provided", async () => {
    const result = await storage.searchStoredIssues({});
    expect(result.count).toBe(2);
    expect(result.issues.map((i) => i.id)).toEqual(["issue-1", "issue-2"]);
  });

  test("filters by project", async () => {
    const result = await storage.searchStoredIssues({ projectId: "project-beta" });
    expect(result.count).toBe(1);
    expect(result.issues[0]?.id).toBe("issue-2");
  });

  test("filters by label", async () => {
    const result = await storage.searchStoredIssues({ labelId: "label-bug" });
    expect(result.count).toBe(1);
    expect(result.issues[0]?.id).toBe("issue-1");
  });

  test("filters by cycle", async () => {
    const result = await storage.searchStoredIssues({ cycleId: "cycle-2" });
    expect(result.count).toBe(1);
    expect(result.issues[0]?.id).toBe("issue-2");
  });

  test("falls back to nested relation ids when normalized fields are missing", async () => {
    await storage.writeLinearDataset("issues", {
      fetchedAt: new Date().toISOString(),
      count: 1,
      items: [
        {
          id: "issue-nested",
          labelIds: [],
          _project: { id: "project-nested" },
          _cycle: { id: "cycle-nested" },
        } as LinearIssueFull,
      ],
    });

    const result = await storage.searchStoredIssues({
      projectId: "project-nested",
      cycleId: "cycle-nested",
    });

    expect(result.count).toBe(1);
    expect(result.issues[0]?.id).toBe("issue-nested");
  });
});

describe("findStoredIssueByKey", () => {
  test("returns issue when team key and number match", async () => {
    const result = await storage.findStoredIssueByKey("CORE-1");
    expect(result.issue?.id).toBe("issue-1");
  });

  test("returns null when no match", async () => {
    const result = await storage.findStoredIssueByKey("CORE-999");
    expect(result.issue).toBeNull();
  });
});
