import path from "node:path";
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
import { getUsageText, getLinearUsageText, getFigmaUsageText } from "./src/help";
import { captureFigmaNodes, parseNodeEntriesFromFile, validateFigmaConfig } from "./src/figma";
import type { FigmaNodeEntry } from "./src/figma/types";
import { normalizeFormat, printPayload, writePayload } from "./src/output";
import { logger } from "./src/logger";

const [, , command, ...rawArgs] = process.argv;

const printHelp = () => {
  console.log(getUsageText());
};

const printLinearHelp = () => {
  console.log(getLinearUsageText());
};

const printFigmaHelp = () => {
  console.log(getFigmaUsageText());
};

const exitWithUsage = (message?: string) => {
  if (message) console.error(message);
  printHelp();
  process.exit(1);
};

const hasFlag = (args: string[], flag: string) =>
  args.some((token) => token === `--${flag}` || token.startsWith(`--${flag}=`));

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

const flagsRequiringValue = new Set([
  "--format",
  "--project",
  "--label",
  "--cycle",
  "--output",
  "--scale",
  "--ids-file",
]);

const getPositionalArgs = (args: string[]) => {
  const positional: string[] = [];

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token) continue;
    if (token.startsWith("--")) continue;

    const prev = args[i - 1];
    const prevFlag = prev?.split("=", 1)[0];
    if (prevFlag && flagsRequiringValue.has(prevFlag)) continue;

    positional.push(token);
  }

  return positional;
};

const parseOutputFormat = (args: string[]) => normalizeFormat(getFlagValue(args, "format"));
const parseRemoteFlag = (args: string[]) => hasFlag(args, "remote");
const parseAllFieldsFlag = (args: string[]) => hasFlag(args, "all-fields");
const parseOutputOption = (args: string[]) => ({
  enabled: hasFlag(args, "output"),
  path: getFlagValue(args, "output"),
});

const buildDefaultOutputPath = (commandKey: string, format: string) => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const ext = format === "csv" ? "csv" : "json";
  const dir = path.resolve(process.cwd(), "storage", "exports");
  return path.join(dir, `${commandKey}-${timestamp}.${ext}`);
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

const readDatasetOrThrow = async <T>(name: string) => {
  try {
    return await readLinearDataset<T>(name);
  } catch {
    throw new Error(
      `Local dataset "${name}" not found. Run "cli-name linear sync --remote" or re-run this command with --remote.`,
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
    () =>
      fetchWorkspaceProjects({ full: wantsFull }) as Promise<
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

const runLinearSync = async () => {
  logger.info("Fetching latest data from Linear...");
  const masterData = await fetchLinearMasterData();
  logger.info("Fetched datasets. Writing to storage...");

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
      logger.info(`Writing ${items.length} records for ${name}...`);
      const storedAt = await writeLinearDataset(name, {
        fetchedAt: masterData.fetchedAt,
        count: items.length,
        items,
      });
      logger.info(`Stored ${name} dataset at ${storedAt}`);
      return { name, filePath: storedAt, count: items.length };
    }),
  );

  logger.info("Sync completed.");
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    source: "remote",
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
    source: "local",
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
  const skipAnalyticsFilter = parseAllFieldsFlag(linearArgs);
  const positionalArgs = getPositionalArgs(linearArgs);
  const outputOption = parseOutputOption(linearArgs);

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
          console.error("Usage: cli-name linear issue <KEY>");
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
        payload = await runLinearSync();
        break;
      }
      default:
        console.error(`Unknown linear subcommand: ${subCommand}`);
        printLinearHelp();
        process.exit(1);
    }

    printPayload(payload, format, { collectionKey, skipAnalyticsFilter });

    if (outputOption.enabled) {
      const targetPath = outputOption.path
        ? path.resolve(process.cwd(), outputOption.path)
        : buildDefaultOutputPath(`linear-${subCommand}`, format);
      await writePayload(payload, format, { collectionKey, skipAnalyticsFilter }, targetPath);
      console.log(`Saved output to ${targetPath}`);
    }
  } catch (error) {
    console.error("Failed to execute linear command.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

/**
 * figma capture コマンドの実行
 */
const runFigmaCapture = async (args: string[]) => {
  const configCheck = validateFigmaConfig();
  if (!configCheck.valid) {
    console.error("Figma configuration is incomplete:");
    configCheck.errors.forEach((err) => console.error(`  - ${err}`));
    console.error("\nRefer to README.md for setup instructions.");
    process.exit(1);
  }

  const idsFilePath = getFlagValue(args, "ids-file");

  if (!idsFilePath) {
    console.error("Error: --ids-file is required.");
    printFigmaHelp();
    process.exit(1);
  }

  const formatValue = getFlagValue(args, "format");
  const acceptedFormats = new Set(["png", "jpg"]);
  if (formatValue && !acceptedFormats.has(formatValue)) {
    console.error('Error: --format must be either "png" or "jpg".');
    process.exit(1);
  }
  const format = formatValue as "png" | "jpg" | undefined;

  const scaleValue = getFlagValue(args, "scale");
  let scale: 1 | 2 | 3 | 4 | undefined;
  if (scaleValue !== undefined) {
    const parsedScale = Number(scaleValue);
    if (!Number.isInteger(parsedScale) || parsedScale < 1 || parsedScale > 4) {
      console.error("Error: --scale must be an integer between 1 and 4.");
      process.exit(1);
    }
    scale = parsedScale as 1 | 2 | 3 | 4;
  }

  const outputPath = getFlagValue(args, "output");

  // Load node entries from file (supports .txt and .json)
  let nodeEntries: FigmaNodeEntry[] = [];
  try {
    nodeEntries = await parseNodeEntriesFromFile(idsFilePath);
  } catch (error) {
    console.error(`Failed to load node entries from "${idsFilePath}"`);
    if (error instanceof Error) console.error(error.message);
    process.exit(1);
  }

  if (!nodeEntries.length) {
    console.error("No valid node entries were found in the file.");
    process.exit(1);
  }

  try {
    console.log(`Capturing ${nodeEntries.length} Figma node(s)...`);
    const results = await captureFigmaNodes({
      nodeEntries,
      format,
      scale,
      outputPath,
    });

    console.log("");
    results.forEach((result) => {
      console.log(`✓ ${result.fileKey}/${result.nodeId} (${result.format}) -> ${result.savedPath}`);
    });
    console.log(`\nSaved ${results.length} file(s). Timestamp: ${results[0]?.timestamp}`);
  } catch (error) {
    console.error("Failed to capture Figma nodes.");
    if (error instanceof Error) console.error(error.message);
    process.exit(1);
  }
};

/**
 * figma コマンドのルーター
 */
const runFigma = async (args: string[]) => {
  const [subCommand, ...figmaArgs] = args;

  if (!subCommand || subCommand === "help") {
    printFigmaHelp();
    if (!subCommand) process.exit(1);
    return;
  }

  switch (subCommand) {
    case "capture":
      await runFigmaCapture(figmaArgs);
      break;
    default:
      console.error(`Unknown figma subcommand: ${subCommand}`);
      printFigmaHelp();
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
  case "figma":
    void runFigma(rawArgs);
    break;
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
