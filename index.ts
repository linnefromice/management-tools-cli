import { CliUsageError, resolveGreetingFromArgs } from "./src/greet";
import {
  LINEAR_WORKSPACE_ID,
  fetchWorkspaceProjects,
  fetchWorkspaceTeams,
} from "./src/linear";

const [, , command, ...rawArgs] = process.argv;

const usage = `Usage:
  bun run index.ts help
  bun run index.ts greet --hour <HH> --name <YourName>
  bun run index.ts linear projects [--full]
  bun run index.ts linear teams [--full]`;

const linearUsage = `Linear commands:
  bun run index.ts linear projects [--full]
  bun run index.ts linear teams [--full]`;

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
