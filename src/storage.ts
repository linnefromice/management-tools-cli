import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LinearIssueFull, LinearTeamFull } from "./linear";

const resolveStorageRoot = () =>
  process.env.LINEAR_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");

const resolveLinearDir = () => path.join(resolveStorageRoot(), "linear");

const ensureDir = async (dir: string) => {
  await mkdir(dir, { recursive: true });
};

export type StoredDataset<T> = {
  fetchedAt: string;
  count: number;
  items: T[];
};

const linearDatasetPath = (name: string) => path.join(resolveLinearDir(), `${name}.json`);

export const writeLinearDataset = async <T>(
  name: string,
  payload: StoredDataset<T>,
): Promise<string> => {
  const dir = resolveLinearDir();
  await ensureDir(dir);
  const target = linearDatasetPath(name);
  await writeFile(target, JSON.stringify(payload, null, 2), "utf-8");
  return target;
};

export const readLinearDataset = async <T>(name: string): Promise<StoredDataset<T>> => {
  const file = linearDatasetPath(name);
  const content = await readFile(file, "utf-8");
  return JSON.parse(content) as StoredDataset<T>;
};

export type IssueSearchFilters = {
  projectId?: string;
  labelId?: string;
  cycleId?: string;
};

type StoredIssueRecord = LinearIssueFull & {
  projectId?: string;
  cycleId?: string;
  labelIds?: string[];
  _project?: { id?: string };
  _cycle?: { id?: string };
};

const resolveProjectId = (issue: StoredIssueRecord) =>
  issue.projectId ?? issue._project?.id ?? undefined;

const resolveCycleId = (issue: StoredIssueRecord) => issue.cycleId ?? issue._cycle?.id ?? undefined;

const resolveLabelIds = (issue: StoredIssueRecord) => issue.labelIds ?? [];

const parseIssueKey = (issueKey: string) => {
  const [teamKey, numberPart] = issueKey.split("-");
  const issueNumber = Number(numberPart);

  if (!teamKey || !numberPart || Number.isNaN(issueNumber)) {
    throw new Error(`Invalid issue key: ${issueKey}. Expected format TEAM-123.`);
  }

  return { teamKey, issueNumber };
};

const getTeamKeyById = async () => {
  const dataset = await readLinearDataset<LinearTeamFull>("teams");
  const map = new Map<string, string>();
  dataset.items.forEach((team) => {
    const id = (team as { id?: string }).id;
    const key = (team as { key?: string }).key;
    if (id && key) {
      map.set(id, key);
    }
  });
  return map;
};

export const searchStoredIssues = async (filters: IssueSearchFilters) => {
  const dataset = await readLinearDataset<LinearIssueFull>("issues");

  const filtered = dataset.items.filter((issue) => {
    const record = issue as StoredIssueRecord;
    const matchesProject = !filters.projectId || resolveProjectId(record) === filters.projectId;
    const labelIds = resolveLabelIds(record);
    const matchesLabel = !filters.labelId || labelIds.includes(filters.labelId);
    const matchesCycle = !filters.cycleId || resolveCycleId(record) === filters.cycleId;
    return matchesProject && matchesLabel && matchesCycle;
  });

  return {
    fetchedAt: dataset.fetchedAt,
    filters,
    count: filtered.length,
    issues: filtered,
  };
};

export const getLinearStorageDir = () => resolveLinearDir();

export const findStoredIssueByKey = async (issueKey: string) => {
  const { teamKey, issueNumber } = parseIssueKey(issueKey);
  const issuesDataset = await readLinearDataset<LinearIssueFull>("issues");
  let teamKeyMap: Map<string, string> | null = null;

  const findTeamKey = async (issue: LinearIssueFull) => {
    const inlineKey = (issue as { team?: { key?: string } }).team?.key;
    if (inlineKey) return inlineKey;

    const teamId = (issue as { teamId?: string }).teamId;
    if (!teamId) return undefined;

    if (!teamKeyMap) {
      teamKeyMap = await getTeamKeyById();
    }

    return teamKeyMap.get(teamId);
  };

  for (const issue of issuesDataset.items) {
    const issueNumberValue = (issue as { number?: number }).number;
    if (issueNumberValue !== issueNumber) continue;

    const resolvedTeamKey = await findTeamKey(issue);
    if (resolvedTeamKey === teamKey) {
      return { fetchedAt: issuesDataset.fetchedAt, issue };
    }
  }

  return { fetchedAt: issuesDataset.fetchedAt, issue: null };
};
