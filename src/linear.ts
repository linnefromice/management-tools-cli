import { LinearClient, Project, Team } from "@linear/sdk";

const PAGE_SIZE = 50;

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

let linearClient: LinearClient | null = null;

const getLinearClient = () => {
  if (!linearClient) {
    linearClient = new LinearClient({
      apiKey: requireEnv("LINEAR_API_KEY"),
    });
  }
  return linearClient;
};

const getWorkspaceId = () => requireEnv("LINEAR_WORKSPACE_ID");

let validatedWorkspaceId: string | null = null;

const ensureWorkspaceAccess = async () => {
  const linear = getLinearClient();
  if (validatedWorkspaceId) {
    return { linear, organizationId: validatedWorkspaceId };
  }

  const expectedWorkspace = getWorkspaceId();
  const viewer = await linear.viewer;
  const organization = await viewer.organization;
  const organizationId = organization.id;

  if (expectedWorkspace && organizationId !== expectedWorkspace) {
    throw new Error(
      `Authenticated workspace (${organizationId}) does not match expected workspace (${expectedWorkspace}).`,
    );
  }

  validatedWorkspaceId = organizationId;
  return { linear, organizationId };
};

export const LINEAR_WORKSPACE_ID = process.env.LINEAR_WORKSPACE_ID ?? "(not set)";

export type LinearProjectSummary = {
  id: string;
  name: string;
  state: string;
  targetDate?: string;
  url: string;
  teamIds: string[];
};

export type LinearProjectFull = Record<string, unknown>;

export type FetchWorkspaceProjectsOptions = {
  full?: boolean;
};

export type LinearIssueFull = Record<string, unknown>;
export type LinearUserFull = Record<string, unknown>;
export type LinearLabelFull = Record<string, unknown>;
export type LinearCycleFull = Record<string, unknown>;

export type LinearMasterData = {
  fetchedAt: string;
  teams: LinearTeamFull[];
  projects: LinearProjectFull[];
  issues: LinearIssueFull[];
  users: LinearUserFull[];
  labels: LinearLabelFull[];
  cycles: LinearCycleFull[];
};

export type LinearTeamSummary = {
  id: string;
  name: string;
  key: string;
  description?: string;
};

export type LinearTeamFull = Record<string, unknown>;

export type FetchWorkspaceTeamsOptions = {
  full?: boolean;
};

const summarizeProject = async (project: Project): Promise<LinearProjectSummary> => {
  const teamsConnection = await project.teams({ first: PAGE_SIZE });

  return {
    id: project.id,
    name: project.name,
    state: project.state,
    targetDate: project.targetDate ?? undefined,
    url: project.url,
    teamIds: teamsConnection.nodes.map((team) => team.id),
  };
};

const projectToPlainObject = (project: Project): LinearProjectFull =>
  JSON.parse(JSON.stringify(project));

const summarizeTeam = (team: Team): LinearTeamSummary => ({
  id: team.id,
  name: team.name,
  key: team.key,
  description: team.description ?? undefined,
});

const teamToPlainObject = (team: Team): LinearTeamFull => JSON.parse(JSON.stringify(team));

const entityToPlainObject = <T>(entity: T): Record<string, unknown> =>
  JSON.parse(JSON.stringify(entity));

const paginateConnection = async <T>(
  fetchPage: (cursor?: string | null) => Promise<{
    nodes: T[];
    pageInfo: { hasNextPage: boolean; endCursor?: string | null };
  }>,
): Promise<T[]> => {
  const items: T[] = [];
  let cursor: string | null | undefined = null;

  do {
    const connection = await fetchPage(cursor);
    items.push(...connection.nodes);
    cursor =
      connection.pageInfo.hasNextPage && connection.pageInfo.endCursor
        ? connection.pageInfo.endCursor
        : null;
  } while (cursor);

  return items;
};

export const fetchWorkspaceProjects = async (
  options: FetchWorkspaceProjectsOptions = {},
): Promise<LinearProjectSummary[] | LinearProjectFull[]> => {
  const { full = false } = options;
  const { linear } = await ensureWorkspaceAccess();

  const results: Array<LinearProjectSummary | LinearProjectFull> = [];
  let cursor: string | null | undefined;

  do {
    const connection = await linear.projects({
      first: PAGE_SIZE,
      after: cursor ?? undefined,
      includeArchived: false,
    });

    const mapped = full
      ? connection.nodes.map(projectToPlainObject)
      : await Promise.all(connection.nodes.map(summarizeProject));

    results.push(...mapped);

    cursor =
      connection.pageInfo.hasNextPage && connection.pageInfo.endCursor
        ? connection.pageInfo.endCursor
        : null;
  } while (cursor);

  return results;
};

const fetchIssuesPlain = async (): Promise<LinearIssueFull[]> => {
  const { linear } = await ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.issues({ first: PAGE_SIZE, after: cursor ?? undefined, includeArchived: false }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchUsersPlain = async (): Promise<LinearUserFull[]> => {
  const { linear } = await ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.users({ first: PAGE_SIZE, after: cursor ?? undefined }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchLabelsPlain = async (): Promise<LinearLabelFull[]> => {
  const { linear } = await ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.issueLabels({ first: PAGE_SIZE, after: cursor ?? undefined, includeArchived: false }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchCyclesPlain = async (): Promise<LinearCycleFull[]> => {
  const { linear } = await ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.cycles({ first: PAGE_SIZE, after: cursor ?? undefined }),
  );
  return nodes.map(entityToPlainObject);
};

export const fetchLinearMasterData = async (): Promise<LinearMasterData> => {
  const [teams, projects, issues, users, labels, cycles] = await Promise.all([
    fetchWorkspaceTeams({ full: true }) as Promise<LinearTeamFull[]>,
    fetchWorkspaceProjects({ full: true }) as Promise<LinearProjectFull[]>,
    fetchIssuesPlain(),
    fetchUsersPlain(),
    fetchLabelsPlain(),
    fetchCyclesPlain(),
  ]);

  return {
    fetchedAt: new Date().toISOString(),
    teams,
    projects,
    issues,
    users,
    labels,
    cycles,
  };
};

export const fetchWorkspaceTeams = async (
  options: FetchWorkspaceTeamsOptions = {},
): Promise<LinearTeamSummary[] | LinearTeamFull[]> => {
  const { full = false } = options;
  const { linear } = await ensureWorkspaceAccess();

  const results: Array<LinearTeamSummary | LinearTeamFull> = [];
  let cursor: string | null | undefined;

  do {
    const connection = await linear.teams({
      first: PAGE_SIZE,
      after: cursor ?? undefined,
      includeArchived: false,
    });

    const mapped = full
      ? connection.nodes.map(teamToPlainObject)
      : connection.nodes.map(summarizeTeam);

    results.push(...mapped);

    cursor =
      connection.pageInfo.hasNextPage && connection.pageInfo.endCursor
        ? connection.pageInfo.endCursor
        : null;
  } while (cursor);

  return results;
};

export const fetchWorkspaceIssues = async (): Promise<LinearIssueFull[]> => fetchIssuesPlain();

export const fetchWorkspaceUsers = async (): Promise<LinearUserFull[]> => fetchUsersPlain();

export const fetchWorkspaceLabels = async (): Promise<LinearLabelFull[]> => fetchLabelsPlain();

export const fetchWorkspaceCycles = async (): Promise<LinearCycleFull[]> => fetchCyclesPlain();
