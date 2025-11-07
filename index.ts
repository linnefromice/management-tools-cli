import { CliUsageError, resolveGreetingFromArgs } from "./src/greet";

const [, , command, ...rawArgs] = process.argv;

const usage = `Usage: bun run index.ts greet --hour <HH> --name <YourName>`;

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

switch (command) {
  case "greet":
    runGreet();
    break;
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
