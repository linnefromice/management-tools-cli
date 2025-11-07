import { LinearClient, Project } from "@linear/sdk";

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

export const fetchWorkspaceProjects = async (
  options: FetchWorkspaceProjectsOptions = {},
): Promise<LinearProjectSummary[] | LinearProjectFull[]> => {
  const { full = false } = options;
  const linear = getLinearClient();
  const expectedWorkspace = getWorkspaceId();

  const viewer = await linear.viewer;
  const organization = await viewer.organization;
  const organizationId = organization.id;

  if (expectedWorkspace && organizationId !== expectedWorkspace) {
    throw new Error(
      `Authenticated workspace (${organizationId}) does not match expected workspace (${expectedWorkspace}).`,
    );
  }

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
