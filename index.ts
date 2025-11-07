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
import { writeLinearDataset } from "./src/storage";

const [, , command, ...rawArgs] = process.argv;

const usage = `Usage:
  bun run index.ts help
  bun run index.ts greet --hour <HH> --name <YourName>
  bun run index.ts linear projects [--full]
  bun run index.ts linear teams [--full]
  bun run index.ts linear issues
  bun run index.ts linear users
  bun run index.ts linear labels
  bun run index.ts linear cycles
  bun run index.ts linear sync`;

const linearUsage = `Linear commands:
  bun run index.ts linear projects [--full]
  bun run index.ts linear teams [--full]
  bun run index.ts linear issues
  bun run index.ts linear users
  bun run index.ts linear labels
  bun run index.ts linear cycles
  bun run index.ts linear sync`;

const printHelp = () => {
  console.log(usage);
};

const printLinearHelp = () => {
  console.log(linearUsage);
};

const exitWithUsage = (message?: string) => {
  if (message) console.error(message);
  printHelp();
  process.exit(1);
};

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

const runLinear = async (args: string[]) => {
  const [subCommand, ...linearArgs] = args;

  if (!subCommand || subCommand === "help") {
    printLinearHelp();
    if (!subCommand) process.exit(1);
    return;
  }

  const wantsFull = linearArgs.includes("--full");

  try {
    let payload: Record<string, unknown>;

    switch (subCommand) {
      case "projects":
        payload = await runLinearProjects(wantsFull);
        break;
      case "teams":
        payload = await runLinearTeams(wantsFull);
        break;
      case "issues":
        payload = await runLinearIssues();
        break;
      case "users":
        payload = await runLinearUsers();
        break;
      case "labels":
        payload = await runLinearLabels();
        break;
      case "cycles":
        payload = await runLinearCycles();
        break;
      case "sync":
        payload = await runLinearSync();
        break;
      default:
        console.error(`Unknown linear subcommand: ${subCommand}`);
        printLinearHelp();
        process.exit(1);
    }

    console.log(JSON.stringify(payload, null, 2));
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
