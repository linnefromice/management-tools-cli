import { CliUsageError, resolveGreetingFromArgs } from "./src/greet";
import {
  LINEAR_WORKSPACE_ID,
  type LinearProjectSummary,
  type LinearProjectFull,
  type LinearTeamSummary,
  type LinearTeamFull,
  type LinearIssueFull,
  type LinearUserFull,
  type LinearLabelFull,
  type LinearCycleFull,
  fetchWorkspaceProjects,
  fetchWorkspaceTeams,
  fetchWorkspaceIssues,
  fetchWorkspaceUsers,
  fetchWorkspaceLabels,
  fetchWorkspaceCycles,
  fetchLinearMasterData,
} from "./src/linear";
import {
  findStoredIssueByKey,
  readLinearDataset,
  searchStoredIssues,
  writeLinearDataset,
} from "./src/storage";
import { getUsageText, getLinearUsageText } from "./src/help";
import { normalizeFormat, printPayload } from "./src/output";

const [, , command, ...rawArgs] = process.argv;

const printHelp = () => {
  console.log(getUsageText());
};

const printLinearHelp = () => {
  console.log(getLinearUsageText());
};

const exitWithUsage = (message?: string) => {
  if (message) console.error(message);
  printHelp();
  process.exit(1);
};

const getFlagValue = (args: string[], flag: string): string | undefined => {
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token || !token.startsWith(`--${flag}`)) continue;

    if (token.includes("=")) {
      const [, value] = token.split("=", 2);
      return value ?? undefined;
    }

    const next = args[i + 1];
    return next && !next.startsWith("--") ? next : undefined;
  }

  return undefined;
};

const getPositionalArgs = (args: string[]) =>
  args.filter((token) => token && !token.startsWith("--"));

const parseOutputFormat = (args: string[]) => normalizeFormat(getFlagValue(args, "format"));
const parseRemoteFlag = (args: string[]) => args.includes("--remote");

if (!command) {
  exitWithUsage();
}

const runGreet = () => {
  try {
    const message = resolveGreetingFromArgs(rawArgs);
    console.log(message);
  } catch (error) {
    if (error instanceof CliUsageError) {
      exitWithUsage(error.message);
    }
    throw error;
  }
};

const readDatasetOrThrow = async <T>(name: string) => {
  try {
    return await readLinearDataset<T>(name);
  } catch {
    throw new Error(
      `Local dataset "${name}" not found. Run "bun run index.ts linear sync --remote" or re-run this command with --remote.`,
    );
  }
};

const getDataset = async <T>(
  name: string,
  remote: boolean,
  fetcher: () => Promise<T[]>,
): Promise<{ fetchedAt: string; items: T[]; source: "remote" | "local" }> => {
  if (remote) {
    const items = await fetcher();
    const fetchedAt = new Date().toISOString();
    await writeLinearDataset(name, { fetchedAt, count: items.length, items });
    return { fetchedAt, items, source: "remote" };
  }

  const dataset = await readDatasetOrThrow<T>(name);
  return { fetchedAt: dataset.fetchedAt, items: dataset.items, source: "local" };
};

const runLinearProjects = async (wantsFull: boolean, remote: boolean) => {
  const dataset = await getDataset<LinearProjectSummary | LinearProjectFull>(
    "projects",
    remote,
    () => fetchWorkspaceProjects({ full: wantsFull }) as Promise<
      Array<LinearProjectSummary | LinearProjectFull>
    >,
  );

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    full: remote ? wantsFull : undefined,
    count: dataset.items.length,
    projects: dataset.items,
  };
};

const runLinearTeams = async (wantsFull: boolean, remote: boolean) => {
  const dataset = await getDataset<LinearTeamSummary | LinearTeamFull>(
    "teams",
    remote,
    () =>
      fetchWorkspaceTeams({ full: wantsFull }) as Promise<
        Array<LinearTeamSummary | LinearTeamFull>
      >,
  );

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    full: remote ? wantsFull : undefined,
    count: dataset.items.length,
    teams: dataset.items,
  };
};

const runLinearIssues = async (remote: boolean) => {
  const dataset = await getDataset<LinearIssueFull>("issues", remote, () => fetchWorkspaceIssues());
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    issues: dataset.items,
  };
};

const runLinearUsers = async (remote: boolean) => {
  const dataset = await getDataset<LinearUserFull>("users", remote, () => fetchWorkspaceUsers());
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    users: dataset.items,
  };
};

const runLinearLabels = async (remote: boolean) => {
  const dataset = await getDataset<LinearLabelFull>("labels", remote, () => fetchWorkspaceLabels());
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    labels: dataset.items,
  };
};

const runLinearCycles = async (remote: boolean) => {
  const dataset = await getDataset<LinearCycleFull>("cycles", remote, () => fetchWorkspaceCycles());
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    cycles: dataset.items,
  };
};

const runLinearIssueByKey = async (issueKey: string) => {
  const result = await findStoredIssueByKey(issueKey);

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    issueKey,
    fetchedAt: result.fetchedAt,
    found: Boolean(result.issue),
    issue: result.issue,
  };
};

const runLinearSync = async (dataTypes?: string[]) => {
  // Define valid data types
  const validTypes = ["teams", "projects", "issues", "users", "labels", "cycles"];

  // Validate that all requested data types are valid before fetching data
  if (dataTypes && dataTypes.length > 0) {
    const invalidTypes = dataTypes.filter(type => !validTypes.includes(type));
    if (invalidTypes.length > 0) {
      throw new Error(
        `Invalid data type(s): ${invalidTypes.join(", ")}. Valid types are: ${validTypes.join(", ")}`
      );
    }
  }

  const masterData = await fetchLinearMasterData();
  const allDatasets = {
    teams: masterData.teams,
    projects: masterData.projects,
    issues: masterData.issues,
    users: masterData.users,
    labels: masterData.labels,
    cycles: masterData.cycles,
  };

  // Filter datasets based on dataTypes parameter
  const datasets = dataTypes && dataTypes.length > 0
    ? Object.fromEntries(
        Object.entries(allDatasets).filter(([name]) => dataTypes.includes(name))
      )
    : allDatasets;

  const files = await Promise.all(
    Object.entries(datasets).map(async ([name, items]) => {
      const storedAt = await writeLinearDataset(name, {
        fetchedAt: masterData.fetchedAt,
        count: items.length,
        items,
      });
      return { name, filePath: storedAt, count: items.length };
    }),
  );

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: masterData.fetchedAt,
    files,
    ...(dataTypes && dataTypes.length > 0 ? { syncedTypes: dataTypes } : {}),
  };
};

const parseIssueStorageFilters = (args: string[]) => ({
  projectId: getFlagValue(args, "project"),
  labelId: getFlagValue(args, "label"),
  cycleId: getFlagValue(args, "cycle"),
});

const runLinearIssuesLocal = async (args: string[]) => {
  const filters = parseIssueStorageFilters(args);
  const result = await searchStoredIssues(filters);

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    ...result,
  };
};

const runLinear = async (args: string[]) => {
  const [subCommand, ...linearArgs] = args;

  if (!subCommand || subCommand === "help") {
    printLinearHelp();
    if (!subCommand) process.exit(1);
    return;
  }

  const format = parseOutputFormat(linearArgs);
  const wantsFull = linearArgs.includes("--full");
  const useRemote = parseRemoteFlag(linearArgs);
  const positionalArgs = getPositionalArgs(linearArgs);

  try {
    let payload: Record<string, unknown>;
    let collectionKey: string | undefined;

    switch (subCommand) {
      case "projects":
        payload = await runLinearProjects(wantsFull, useRemote);
        collectionKey = "projects";
        break;
      case "teams":
        payload = await runLinearTeams(wantsFull, useRemote);
        collectionKey = "teams";
        break;
      case "issue": {
        const [issueKey] = positionalArgs;
        if (!issueKey) {
          console.error("Usage: bun run index.ts linear issue <KEY>");
          process.exit(1);
        }
        payload = await runLinearIssueByKey(issueKey);
        collectionKey = "issue";
        break;
      }
      case "issues":
        payload = await runLinearIssues(useRemote);
        collectionKey = "issues";
        break;
      case "users":
        payload = await runLinearUsers(useRemote);
        collectionKey = "users";
        break;
      case "labels":
        payload = await runLinearLabels(useRemote);
        collectionKey = "labels";
        break;
      case "cycles":
        payload = await runLinearCycles(useRemote);
        collectionKey = "cycles";
        break;
      case "search-issues":
        payload = await runLinearIssuesLocal(linearArgs);
        collectionKey = "issues";
        break;
      case "sync": {
        // Parse comma-separated data types from positional args
        const dataTypesArg = positionalArgs[0];
        const dataTypes = dataTypesArg ? dataTypesArg.split(",").map(t => t.trim()) : undefined;
        payload = await runLinearSync(dataTypes);
        break;
      }
      default:
        console.error(`Unknown linear subcommand: ${subCommand}`);
        printLinearHelp();
        process.exit(1);
    }

    printPayload(payload, format, { collectionKey });
  } catch (error) {
    console.error("Failed to execute linear command.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

switch (command) {
  case "greet":
    runGreet();
    break;
  case "help":
    printHelp();
    break;
  case "linear":
    void runLinear(rawArgs);
    break;
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
