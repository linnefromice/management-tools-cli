import { CliUsageError, resolveGreetingFromArgs } from "./src/greet";
import {
  LINEAR_WORKSPACE_ID,
  fetchWorkspaceProjects,
  fetchWorkspaceTeams,
  fetchWorkspaceIssues,
  fetchWorkspaceUsers,
  fetchWorkspaceLabels,
  fetchWorkspaceCycles,
  fetchLinearMasterData,
} from "./src/linear";
import { findStoredIssueByKey, searchStoredIssues, writeLinearDataset } from "./src/storage";
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

const runLinearProjects = async (wantsFull: boolean) => {
  const projects = await fetchWorkspaceProjects({ full: wantsFull });

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    full: wantsFull,
    count: projects.length,
    projects,
  };
};

const runLinearTeams = async (wantsFull: boolean) => {
  const teams = await fetchWorkspaceTeams({ full: wantsFull });

  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    full: wantsFull,
    count: teams.length,
    teams,
  };
};

const runLinearIssues = async () => {
  const issues = await fetchWorkspaceIssues();
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    count: issues.length,
    issues,
  };
};

const runLinearUsers = async () => {
  const users = await fetchWorkspaceUsers();
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    count: users.length,
    users,
  };
};

const runLinearLabels = async () => {
  const labels = await fetchWorkspaceLabels();
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    count: labels.length,
    labels,
  };
};

const runLinearCycles = async () => {
  const cycles = await fetchWorkspaceCycles();
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    count: cycles.length,
    cycles,
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

const runLinearSync = async () => {
  const masterData = await fetchLinearMasterData();
  const datasets = {
    teams: masterData.teams,
    projects: masterData.projects,
    issues: masterData.issues,
    users: masterData.users,
    labels: masterData.labels,
    cycles: masterData.cycles,
  };

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
  const positionalArgs = getPositionalArgs(linearArgs);

  try {
    let payload: Record<string, unknown>;
    let collectionKey: string | undefined;

    switch (subCommand) {
      case "projects":
        payload = await runLinearProjects(wantsFull);
        collectionKey = "projects";
        break;
      case "teams":
        payload = await runLinearTeams(wantsFull);
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
        payload = await runLinearIssues();
        collectionKey = "issues";
        break;
      case "users":
        payload = await runLinearUsers();
        collectionKey = "users";
        break;
      case "labels":
        payload = await runLinearLabels();
        collectionKey = "labels";
        break;
      case "cycles":
        payload = await runLinearCycles();
        collectionKey = "cycles";
        break;
      case "issues-local":
        payload = await runLinearIssuesLocal(linearArgs);
        collectionKey = "issues";
        break;
      case "sync":
        payload = await runLinearSync();
        break;
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
