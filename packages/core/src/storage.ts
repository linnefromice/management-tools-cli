import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { LinearIssueFull, LinearTeamFull } from "./linear";

const ensureDir = async (dir: string) => {
  await mkdir(dir, { recursive: true });
};

export type StoredDataset<T> = {
  fetchedAt: string;
  count: number;
  items: T[];
};

export type LinearStorageConfig = {
  rootDir: string;
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

const linearDatasetPath = (dir: string, name: string) => path.join(dir, `${name}.json`);

const readLinearDatasetInternal = async <T>(dir: string, name: string): Promise<StoredDataset<T>> => {
  const file = linearDatasetPath(dir, name);
  const content = await readFile(file, "utf-8");
  return JSON.parse(content) as StoredDataset<T>;
};

const writeLinearDatasetInternal = async <T>(
  dir: string,
  name: string,
  payload: StoredDataset<T>,
): Promise<string> => {
  await ensureDir(dir);
  const target = linearDatasetPath(dir, name);
  await writeFile(target, JSON.stringify(payload, null, 2), "utf-8");
  return target;
};

const getTeamKeyById = async (dir: string) => {
  const dataset = await readLinearDatasetInternal<LinearTeamFull>(dir, "teams");
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

export type LinearStorage = {
  writeLinearDataset: <T>(name: string, payload: StoredDataset<T>) => Promise<string>;
  readLinearDataset: <T>(name: string) => Promise<StoredDataset<T>>;
  searchStoredIssues: (filters: IssueSearchFilters) => Promise<{
    fetchedAt: string;
    filters: IssueSearchFilters;
    count: number;
    issues: LinearIssueFull[];
  }>;
  findStoredIssueByKey: (
    issueKey: string,
  ) => Promise<{ fetchedAt: string; issue: LinearIssueFull | null }>;
  getLinearStorageDir: () => string;
};

export const createLinearStorage = (config: LinearStorageConfig): LinearStorage => {
  const linearDir = path.join(config.rootDir, "linear");

  return {
    writeLinearDataset: (name, payload) => writeLinearDatasetInternal(linearDir, name, payload),
    readLinearDataset: (name) => readLinearDatasetInternal(linearDir, name),
    searchStoredIssues: async (filters) => {
      const dataset = await readLinearDatasetInternal<LinearIssueFull>(linearDir, "issues");

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
    },
    findStoredIssueByKey: async (issueKey) => {
      const { teamKey, issueNumber } = parseIssueKey(issueKey);
      const issuesDataset = await readLinearDatasetInternal<LinearIssueFull>(linearDir, "issues");
      let teamKeyMap: Map<string, string> | null = null;

      const findTeamKey = async (issue: LinearIssueFull) => {
        const inlineKey = (issue as { team?: { key?: string } }).team?.key;
        if (inlineKey) return inlineKey;

        const teamId = (issue as { teamId?: string }).teamId;
        if (!teamId) return undefined;

        if (!teamKeyMap) {
          teamKeyMap = await getTeamKeyById(linearDir);
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
    },
    getLinearStorageDir: () => linearDir,
  };
};
