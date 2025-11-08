import { describe, expect, test, beforeEach, afterEach } from "bun:test";
import type { LinearClient } from "@linear/sdk";
import {
  fetchWorkspaceProjects,
  fetchWorkspaceTeams,
  fetchWorkspaceIssues,
  fetchWorkspaceUsers,
  fetchWorkspaceLabels,
  fetchWorkspaceCycles,
  fetchLinearMasterData,
  setLinearClientForTesting,
  resetLinearClientForTesting,
} from "../src/linear";

const WORKSPACE_ID = "workspace-test";
const connection = <T>(nodes: T[]) => ({
  nodes,
  pageInfo: { hasNextPage: false, endCursor: null },
});

type MockProject = {
  id: string;
  name: string;
  state: string;
  targetDate?: string | null;
  url: string;
  teams: (input?: unknown) => Promise<ReturnType<typeof connection<{ id: string }>>>;
};

type MockData = {
  projects: MockProject[];
  teams: Array<{ id: string; name: string; key: string; description?: string }>;
  issues: Array<Record<string, unknown>>;
  users: Array<Record<string, unknown>>;
  labels: Array<Record<string, unknown>>;
  cycles: Array<Record<string, unknown>>;
};

const makeMockProject = (partial?: Partial<MockProject>): MockProject => ({
  id: "proj-1",
  name: "Project One",
  state: "active",
  targetDate: null,
  url: "https://linear.app/project/proj-1",
  teams: async () => connection([{ id: "team-1" }]),
  ...partial,
});

const defaultData: MockData = {
  projects: [makeMockProject()],
  teams: [{ id: "team-1", name: "Core", key: "CORE" }],
  issues: [{ id: "iss-1", title: "Fix bug", number: 123, team: { key: "CORE" } }],
  users: [{ id: "user-1", name: "Alice" }],
  labels: [{ id: "lbl-1", name: "Bug" }],
  cycles: [{ id: "cycle-1", name: "Sprint 1" }],
};

const makeMockLinearClient = (data: MockData): LinearClient => {
  const mock = {
    viewer: Promise.resolve({
      organization: Promise.resolve({ id: WORKSPACE_ID }),
    }),
    projects: async () => connection(data.projects),
    teams: async () => connection(data.teams),
    issues: async () => connection(data.issues),
    users: async () => connection(data.users),
    issueLabels: async () => connection(data.labels),
    cycles: async () => connection(data.cycles),
  };

  return mock as unknown as LinearClient;
};

beforeEach(() => {
  process.env.LINEAR_API_KEY = "test-key";
  process.env.LINEAR_WORKSPACE_ID = WORKSPACE_ID;
});

afterEach(() => {
  resetLinearClientForTesting();
});

describe("fetchWorkspaceProjects", () => {
  test("returns summaries with team ids", async () => {
    setLinearClientForTesting(makeMockLinearClient(defaultData));

    const projects = await fetchWorkspaceProjects();

    expect(projects).toEqual([
      {
        id: "proj-1",
        name: "Project One",
        state: "active",
        targetDate: undefined,
        url: "https://linear.app/project/proj-1",
        teamIds: ["team-1"],
      },
    ]);
  });

  test("returns full objects when requested", async () => {
    setLinearClientForTesting(makeMockLinearClient(defaultData));

    const projects = await fetchWorkspaceProjects({ full: true });

    expect(projects).toHaveLength(1);
    expect((projects[0] as Record<string, unknown>).id).toBe("proj-1");
  });
});

describe("fetchWorkspace* helpers", () => {
  test("return datasets from the client", async () => {
    setLinearClientForTesting(makeMockLinearClient(defaultData));

    await expect(fetchWorkspaceTeams()).resolves.toHaveLength(1);
    await expect(fetchWorkspaceIssues()).resolves.toHaveLength(1);
    await expect(fetchWorkspaceUsers()).resolves.toHaveLength(1);
    await expect(fetchWorkspaceLabels()).resolves.toHaveLength(1);
    await expect(fetchWorkspaceCycles()).resolves.toHaveLength(1);
  });
});

describe("fetchLinearMasterData", () => {
  test("aggregates all master datasets", async () => {
    setLinearClientForTesting(makeMockLinearClient(defaultData));

    const master = await fetchLinearMasterData();

    expect(master.teams).toHaveLength(1);
    expect(master.projects).toHaveLength(1);
    expect(master.issues).toHaveLength(1);
    expect(master.users).toHaveLength(1);
    expect(master.labels).toHaveLength(1);
    expect(master.cycles).toHaveLength(1);
    expect(master.fetchedAt).toBeDefined();
  });
});
