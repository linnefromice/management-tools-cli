import { CliUsageError, resolveGreetingFromArgs } from "./src/greet";
import { LINEAR_WORKSPACE_ID, fetchWorkspaceProjects } from "./src/linear";

const [, , command, ...rawArgs] = process.argv;

const usage = `Usage:
  bun run index.ts greet --hour <HH> --name <YourName>
  bun run index.ts linear-projects [--full]`;

const exitWithUsage = (message?: string) => {
  if (message) console.error(message);
  console.log(usage);
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

const runLinearProjects = async () => {
  try {
    const wantsFull = rawArgs.includes("--full");
    const projects = await fetchWorkspaceProjects({ full: wantsFull });

    const payload = {
      workspaceId: LINEAR_WORKSPACE_ID,
      full: wantsFull,
      count: projects.length,
      projects,
    };

    console.log(JSON.stringify(payload, null, 2));
  } catch (error) {
    console.error("Failed to fetch Linear projects.");
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
  case "linear-projects":
    void runLinearProjects();
    break;
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
