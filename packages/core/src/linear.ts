import type { Issue } from "@linear/sdk";
import { LinearClient, Project, Team } from "@linear/sdk";

const PAGE_SIZE = 50;

export type LinearServiceConfig = {
  apiKey: string;
  workspaceId?: string;
  client?: LinearClient;
};

type LinearContext = {
  getLinearClient: () => LinearClient;
  ensureWorkspaceAccess: () => Promise<{ linear: LinearClient; organizationId: string }>;
};

const createLinearContext = (config: LinearServiceConfig): LinearContext => {
  let linearClient = config.client ?? null;
  let validatedWorkspaceId: string | null = null;

  const getLinearClient = () => {
    if (linearClient) {
      return linearClient;
    }
    linearClient = new LinearClient({ apiKey: config.apiKey });
    return linearClient;
  };

  const ensureWorkspaceAccess = async () => {
    const linear = getLinearClient();
    if (validatedWorkspaceId) {
      return { linear, organizationId: validatedWorkspaceId };
    }

    const viewer = await linear.viewer;
    const organization = await viewer.organization;
    const organizationId = organization.id;

    if (config.workspaceId && organizationId !== config.workspaceId) {
      throw new Error(
        `Authenticated workspace (${organizationId}) does not match expected workspace (${config.workspaceId}).`,
      );
    }

    validatedWorkspaceId = organizationId;
    return { linear, organizationId };
  };

  return { getLinearClient, ensureWorkspaceAccess };
};

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

type IssueLikeRecord = LinearIssueFull & {
  projectId?: string | null;
  cycleId?: string | null;
  teamId?: string | null;
  stateId?: string | null;
  assigneeId?: string | null;
  labelIds?: string[];
  _project?: { id?: string | null };
  _cycle?: { id?: string | null };
  _team?: { id?: string | null };
  _state?: { id?: string | null };
  _assignee?: { id?: string | null };
};

const normalizeIssueRecord = (issue: Issue | LinearIssueFull): LinearIssueFull => {
  const plain = entityToPlainObject(issue) as IssueLikeRecord;
  const source = issue as IssueLikeRecord;

  const ensureId = (
    current: string | null | undefined,
    fallbackGetter: () => string | null | undefined,
  ) => current ?? fallbackGetter() ?? undefined;

  plain.projectId = ensureId(plain.projectId, () => source.projectId ?? plain._project?.id);
  plain.cycleId = ensureId(plain.cycleId, () => source.cycleId ?? plain._cycle?.id);
  plain.teamId = ensureId(plain.teamId, () => source.teamId ?? plain._team?.id);
  plain.stateId = ensureId(plain.stateId, () => source.stateId ?? plain._state?.id);
  plain.assigneeId = ensureId(plain.assigneeId, () => source.assigneeId ?? plain._assignee?.id);

  if (!Array.isArray(plain.labelIds) && Array.isArray(source.labelIds)) {
    plain.labelIds = source.labelIds;
  }

  if (!plain.labelIds) {
    plain.labelIds = [];
  }

  return plain;
};

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

const fetchWorkspaceProjectsInternal = async (
  ctx: LinearContext,
  options: FetchWorkspaceProjectsOptions = {},
): Promise<LinearProjectSummary[] | LinearProjectFull[]> => {
  const { full = false } = options;
  const { linear } = await ctx.ensureWorkspaceAccess();

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

const fetchIssuesPlain = async (ctx: LinearContext): Promise<LinearIssueFull[]> => {
  const { linear } = await ctx.ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.issues({ first: PAGE_SIZE, after: cursor ?? undefined, includeArchived: false }),
  );
  return nodes.map(normalizeIssueRecord);
};

const fetchUsersPlain = async (ctx: LinearContext): Promise<LinearUserFull[]> => {
  const { linear } = await ctx.ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.users({ first: PAGE_SIZE, after: cursor ?? undefined }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchLabelsPlain = async (ctx: LinearContext): Promise<LinearLabelFull[]> => {
  const { linear } = await ctx.ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.issueLabels({ first: PAGE_SIZE, after: cursor ?? undefined, includeArchived: false }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchCyclesPlain = async (ctx: LinearContext): Promise<LinearCycleFull[]> => {
  const { linear } = await ctx.ensureWorkspaceAccess();
  const nodes = await paginateConnection((cursor) =>
    linear.cycles({ first: PAGE_SIZE, after: cursor ?? undefined }),
  );
  return nodes.map(entityToPlainObject);
};

const fetchWorkspaceTeamsInternal = async (
  ctx: LinearContext,
  options: FetchWorkspaceTeamsOptions = {},
): Promise<LinearTeamSummary[] | LinearTeamFull[]> => {
  const { full = false } = options;
  const { linear } = await ctx.ensureWorkspaceAccess();

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

const fetchLinearMasterDataInternal = async (ctx: LinearContext): Promise<LinearMasterData> => {
  const [teams, projects, issues, users, labels, cycles] = await Promise.all([
    fetchWorkspaceTeamsInternal(ctx, { full: true }) as Promise<LinearTeamFull[]>,
    fetchWorkspaceProjectsInternal(ctx, { full: true }) as Promise<LinearProjectFull[]>,
    fetchIssuesPlain(ctx),
    fetchUsersPlain(ctx),
    fetchLabelsPlain(ctx),
    fetchCyclesPlain(ctx),
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

export type LinearService = {
  fetchWorkspaceProjects: (
    options?: FetchWorkspaceProjectsOptions,
  ) => Promise<LinearProjectSummary[] | LinearProjectFull[]>;
  fetchWorkspaceTeams: (
    options?: FetchWorkspaceTeamsOptions,
  ) => Promise<LinearTeamSummary[] | LinearTeamFull[]>;
  fetchWorkspaceIssues: () => Promise<LinearIssueFull[]>;
  fetchWorkspaceUsers: () => Promise<LinearUserFull[]>;
  fetchWorkspaceLabels: () => Promise<LinearLabelFull[]>;
  fetchWorkspaceCycles: () => Promise<LinearCycleFull[]>;
  fetchLinearMasterData: () => Promise<LinearMasterData>;
};

export const createLinearService = (config: LinearServiceConfig): LinearService => {
  const ctx = createLinearContext(config);
  return {
    fetchWorkspaceProjects: (options) => fetchWorkspaceProjectsInternal(ctx, options),
    fetchWorkspaceTeams: (options) => fetchWorkspaceTeamsInternal(ctx, options),
    fetchWorkspaceIssues: () => fetchIssuesPlain(ctx),
    fetchWorkspaceUsers: () => fetchUsersPlain(ctx),
    fetchWorkspaceLabels: () => fetchLabelsPlain(ctx),
    fetchWorkspaceCycles: () => fetchCyclesPlain(ctx),
    fetchLinearMasterData: () => fetchLinearMasterDataInternal(ctx),
  };
};
