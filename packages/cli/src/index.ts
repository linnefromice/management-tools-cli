import path from "node:path";
import { CliUsageError, resolveGreetingFromArgs } from "./greet";
import {
  getUsageText,
  getLinearUsageText,
  getFigmaUsageText,
  getGithubUsageText,
} from "./help";
import { normalizeFormat, printPayload, writePayload } from "./output";
import { logger } from "./logger";
import {
  createManagementToolsCore,
  type LinearProjectSummary,
  type LinearProjectFull,
  type LinearTeamSummary,
  type LinearTeamFull,
  type LinearIssueFull,
  type LinearUserFull,
  type LinearLabelFull,
  type LinearCycleFull,
  type RepositoryConfig,
  filterReadyReviewEntries,
  parseNodeEntriesFromFile,
  type FigmaNodeEntry,
} from "@mng-tool/core";
import {
  convertLocalDateTimeToUtc,
  parseLocalDateTimeInput,
  resolveTimeZone,
  type TimeZoneSpec,
} from "@mng-tool/core";

const LINEAR_WORKSPACE_ID = process.env.LINEAR_WORKSPACE_ID ?? "(not set)";

const resolveStorageDir = () =>
  process.env.LINEAR_STORAGE_DIR ?? path.resolve(process.cwd(), "storage");

const resolveGithubRepositoryFromEnv = (): RepositoryConfig | undefined => {
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  if (owner && repo) {
    return { owner, repo };
  }

  const combined = process.env.GITHUB_REPOSITORY;
  if (combined && combined.includes("/")) {
    const [combinedOwner, combinedRepo] = combined.split("/", 2);
    if (combinedOwner && combinedRepo) {
      return { owner: combinedOwner, repo: combinedRepo };
    }
  }

  return undefined;
};

const core = createManagementToolsCore({
  logger,
  storage: { rootDir: resolveStorageDir() },
  linear: process.env.LINEAR_API_KEY
    ? { apiKey: process.env.LINEAR_API_KEY, workspaceId: process.env.LINEAR_WORKSPACE_ID }
    : undefined,
  github: process.env.GITHUB_TOKEN
    ? { token: process.env.GITHUB_TOKEN, defaultRepository: resolveGithubRepositoryFromEnv() }
    : undefined,
  figma: process.env.FIGMA_ACCESS_TOKEN
    ? {
        accessToken: process.env.FIGMA_ACCESS_TOKEN,
        apiBaseUrl: process.env.FIGMA_API_BASE_URL,
        outputDir: process.env.FIGMA_OUTPUT_DIR,
        logger,
      }
    : undefined,
});

const requireLinearService = () => {
  if (!core.linear) {
    throw new Error("Linear is not configured. Set LINEAR_API_KEY.");
  }
  return core.linear;
};

const requireLinearStorage = () => {
  if (!core.storage) {
    throw new Error("Linear storage is not configured.");
  }
  return core.storage;
};

const requireGithubService = () => {
  if (!core.github) {
    throw new Error("GitHub is not configured. Set GITHUB_TOKEN.");
  }
  return core.github;
};

const requireFigmaService = () => {
  if (!core.figma) {
    throw new Error("Figma is not configured. Set FIGMA_ACCESS_TOKEN.");
  }
  return core.figma;
};

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

const printGithubHelp = () => {
  console.log(getGithubUsageText());
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
  "--state",
  "--limit",
  "--created-after",
  "--created-before",
  "--updated-after",
  "--updated-before",
  "--user",
  "--days",
  "--owner",
  "--repo",
  "--timezone",
  "--window-boundary",
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

const parseStateFlag = (args: string[], defaultState: "open" | "closed" | "all" = "open") => {
  const value = getFlagValue(args, "state");
  if (!value) return defaultState;
  const normalized = value.toLowerCase();
  if (normalized === "open" || normalized === "closed" || normalized === "all") {
    return normalized;
  }
  throw new Error('Invalid --state value. Use "open", "closed", or "all".');
};

const parseLimitFlag = (args: string[], defaultValue = 20, max = 200) => {
  const value = getFlagValue(args, "limit");
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("--limit must be a positive integer.");
  }
  return Math.min(parsed, max);
};

const parseDateFlag = (args: string[], flag: string) => {
  const value = getFlagValue(args, flag);
  if (!value) return undefined;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) {
    throw new Error(`Invalid ISO timestamp for --${flag}: ${value}`);
  }
  return new Date(timestamp);
};

const parsePositiveIntFlag = (args: string[], flag: string, defaultValue: number, max?: number) => {
  const value = getFlagValue(args, flag);
  if (!value) return defaultValue;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`--${flag} must be a positive integer.`);
  }
  if (max !== undefined) {
    return Math.min(parsed, max);
  }
  return parsed;
};

const parseRepositoryOverride = (args: string[]): RepositoryConfig | undefined => {
  const owner = getFlagValue(args, "owner");
  const repo = getFlagValue(args, "repo");

  if (!owner && !repo) {
    return undefined;
  }
  if (!owner || !repo) {
    throw new Error("Both --owner and --repo must be provided together.");
  }
  return { owner, repo };
};

const parseWindowBoundary = (
  args: string[],
  timeZoneSpec: TimeZoneSpec,
): { raw?: string; boundary?: Date } => {
  const rawValue = getFlagValue(args, "window-boundary");
  if (!rawValue) {
    return {};
  }
  const localDateTime = parseLocalDateTimeInput(rawValue);
  const boundary = convertLocalDateTimeToUtc(localDateTime, timeZoneSpec);
  return { raw: rawValue, boundary };
};

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
  const storage = requireLinearStorage();
  try {
    return await storage.readLinearDataset<T>(name);
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
  const storage = requireLinearStorage();
  if (remote) {
    const items = await fetcher();
    const fetchedAt = new Date().toISOString();
    await storage.writeLinearDataset(name, { fetchedAt, count: items.length, items });
    return { fetchedAt, items, source: "remote" };
  }

  const dataset = await readDatasetOrThrow<T>(name);
  return { fetchedAt: dataset.fetchedAt, items: dataset.items, source: "local" };
};

const runLinearProjects = async (wantsFull: boolean, remote: boolean) => {
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearProjectSummary | LinearProjectFull>(
    "projects",
    remote,
    () =>
      linearService.fetchWorkspaceProjects({ full: wantsFull }) as Promise<
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
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearTeamSummary | LinearTeamFull>(
    "teams",
    remote,
    () =>
      linearService.fetchWorkspaceTeams({ full: wantsFull }) as Promise<
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
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearIssueFull>("issues", remote, () =>
    linearService.fetchWorkspaceIssues(),
  );
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    issues: dataset.items,
  };
};

const runLinearUsers = async (remote: boolean) => {
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearUserFull>("users", remote, () =>
    linearService.fetchWorkspaceUsers(),
  );
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    users: dataset.items,
  };
};

const runLinearLabels = async (remote: boolean) => {
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearLabelFull>("labels", remote, () =>
    linearService.fetchWorkspaceLabels(),
  );
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    labels: dataset.items,
  };
};

const runLinearCycles = async (remote: boolean) => {
  const linearService = requireLinearService();
  const dataset = await getDataset<LinearCycleFull>("cycles", remote, () =>
    linearService.fetchWorkspaceCycles(),
  );
  return {
    workspaceId: LINEAR_WORKSPACE_ID,
    fetchedAt: dataset.fetchedAt,
    source: dataset.source,
    count: dataset.items.length,
    cycles: dataset.items,
  };
};

const runLinearIssueByKey = async (issueKey: string) => {
  const storage = requireLinearStorage();
  const result = await storage.findStoredIssueByKey(issueKey);

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
  const linearService = requireLinearService();
  const storage = requireLinearStorage();
  const masterData = await linearService.fetchLinearMasterData();
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
      const storedAt = await storage.writeLinearDataset(name, {
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
  const storage = requireLinearStorage();
  const result = await storage.searchStoredIssues(filters);

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

const runGithubPullRequests = async (args: string[]) => {
  const format = parseOutputFormat(args);
  const skipAnalyticsFilter = parseAllFieldsFlag(args);
  const outputOption = parseOutputOption(args);

  try {
    const githubService = requireGithubService();
    const state = parseStateFlag(args);
    const limit = parseLimitFlag(args);
    const createdAfter = parseDateFlag(args, "created-after");
    const createdBefore = parseDateFlag(args, "created-before");
    const updatedAfter = parseDateFlag(args, "updated-after");
    const updatedBefore = parseDateFlag(args, "updated-before");

    const payload = await githubService.fetchRepositoryPullRequests({
      state,
      limit,
      createdAfter,
      createdBefore,
      updatedAfter,
      updatedBefore,
    });

    const collectionKey = "pullRequests";

    if (!outputOption.enabled) {
      printPayload(payload, format, { collectionKey, skipAnalyticsFilter });
    } else {
      const targetPath = outputOption.path ?? buildDefaultOutputPath("github-prs", format);
      await writePayload(payload, format, { collectionKey, skipAnalyticsFilter }, targetPath);
      console.log(`Saved output to ${targetPath}`);
    }
  } catch (error) {
    console.error("Failed to list GitHub pull requests.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

const runGithubReviewStatus = async (args: string[]) => {
  const format = parseOutputFormat(args);
  const skipAnalyticsFilter = parseAllFieldsFlag(args);
  const outputOption = parseOutputOption(args);
  const readyOnly = hasFlag(args, "ready-only");

  try {
    const githubService = requireGithubService();
    const limit = parseLimitFlag(args, 50);
    let payload = await githubService.fetchRecentReviewStatus({ limit });
    if (readyOnly) {
      const filteredEntries = filterReadyReviewEntries(payload.pullRequests);
      payload = {
        ...payload,
        count: filteredEntries.length,
        pullRequests: filteredEntries,
      };
    }
    const collectionKey = "reviewStatus";

    if (!outputOption.enabled) {
      printPayload(payload, format, { collectionKey, skipAnalyticsFilter });
    } else {
      const targetPath =
        outputOption.path ?? buildDefaultOutputPath("github-review-status", format);
      await writePayload(payload, format, { collectionKey, skipAnalyticsFilter }, targetPath);
      console.log(`Saved output to ${targetPath}`);
    }
  } catch (error) {
    console.error("Failed to list GitHub review status.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

const runGithubCommits = async (args: string[]) => {
  const format = parseOutputFormat(args);
  const skipAnalyticsFilter = parseAllFieldsFlag(args);
  const outputOption = parseOutputOption(args);

  try {
    const githubService = requireGithubService();
    const user = getFlagValue(args, "user");
    if (!user) {
      console.error("Error: --user <github-login> is required.");
      process.exit(1);
    }

    const limit = parseLimitFlag(args, 40, 200);
    const windowDays = parsePositiveIntFlag(args, "days", 7);
    const repositoryOverride = parseRepositoryOverride(args);
    const excludeMerges = hasFlag(args, "exclude-merges");
    const timezone = resolveTimeZone(getFlagValue(args, "timezone"));
    const boundary = parseWindowBoundary(args, timezone.spec);
    const until = boundary.boundary ?? new Date();
    const since = new Date(until.getTime() - windowDays * 24 * 60 * 60 * 1000);

    const basePayload = await githubService.fetchUserCommits({
      author: user,
      limit,
      since,
      until,
      repository: repositoryOverride,
      excludeMerges,
    });
    const payload = {
      ...basePayload,
      windowDays,
      windowBoundary: boundary.boundary ? boundary.boundary.toISOString() : undefined,
      timeZone: timezone.label,
    };

    const collectionKey = "commits";

    if (!outputOption.enabled) {
      printPayload(payload, format, { collectionKey, skipAnalyticsFilter });
    } else {
      const targetPath = outputOption.path ?? buildDefaultOutputPath("github-commits", format);
      await writePayload(payload, format, { collectionKey, skipAnalyticsFilter }, targetPath);
      console.log(`Saved output to ${targetPath}`);
    }
  } catch (error) {
    console.error("Failed to list GitHub commits.");
    if (error instanceof Error) {
      console.error(error.message);
    }
    process.exit(1);
  }
};

const runGithub = async (args: string[]) => {
  const [subCommand, ...githubArgs] = args;

  if (!subCommand || subCommand === "help") {
    printGithubHelp();
    if (!subCommand) process.exit(1);
    return;
  }

  switch (subCommand) {
    case "prs":
      await runGithubPullRequests(githubArgs);
      break;
    case "review-status":
      await runGithubReviewStatus(githubArgs);
      break;
    case "commits":
      await runGithubCommits(githubArgs);
      break;
    default:
      console.error(`Unknown github subcommand: ${subCommand}`);
      printGithubHelp();
      process.exit(1);
  }
};

/**
 * figma capture コマンドの実行
 */
const runFigmaCapture = async (args: string[]) => {
  const figmaService = requireFigmaService();
  const configCheck = figmaService.validateConfig();
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
    const results = await figmaService.captureNodes({
      nodeEntries,
      format,
      scale,
      outputPath,
      outputDir: getFlagValue(args, "output-dir"),
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
  case "github":
    void runGithub(rawArgs);
    break;
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
