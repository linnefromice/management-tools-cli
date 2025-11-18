export { createLinearService } from "./linear";
export type {
  LinearService,
  LinearServiceConfig,
  LinearProjectSummary,
  LinearProjectFull,
  LinearTeamSummary,
  LinearTeamFull,
  LinearMasterData,
  LinearIssueFull,
  LinearUserFull,
  LinearLabelFull,
  LinearCycleFull,
  FetchWorkspaceProjectsOptions,
  FetchWorkspaceTeamsOptions,
} from "./linear";

export { createLinearStorage } from "./storage";
export type {
  LinearStorage,
  LinearStorageConfig,
  StoredDataset,
  IssueSearchFilters,
} from "./storage";

export { createGithubService } from "./github";
export type {
  GithubService,
  GithubServiceConfig,
  RepositoryConfig,
  PullRequestQueryOptions,
  GithubPullRequestListResult,
  GithubPullRequestSummary,
  GithubReviewStatusResult,
  GithubReviewStatusEntry,
  GithubCommitListResult,
  GithubCommitSummary,
  CommitQueryOptions,
} from "./github";
export {
  buildReviewStatusEntries,
  filterReadyReviewEntries,
} from "./github";

export { createFigmaService } from "./figma";
export type {
  FigmaService,
  FigmaServiceConfig,
  FigmaCaptureOptions,
  FigmaCaptureResult,
  FigmaNodeEntry,
} from "./figma";
export { parseNodeEntriesFromFile, parseNodeId, validateNodeId, validateFigmaConfig } from "./figma";

export {
  parseLocalDateTimeInput,
  resolveTimeZone,
  convertLocalDateTimeToUtc,
  type TimeZoneSpec,
} from "./time";

export { createNoopLogger } from "./types";
export type { CoreLogger } from "./types";

import { createLinearService } from "./linear";
import { createLinearStorage } from "./storage";
import { createGithubService } from "./github";
import { createFigmaService } from "./figma";
import type { LinearServiceConfig } from "./linear";
import type { LinearStorageConfig } from "./storage";
import type { GithubServiceConfig } from "./github";
import type { FigmaServiceConfig } from "./figma";
import type { CoreLogger } from "./types";

export type CoreConfig = {
  logger?: CoreLogger;
  linear?: LinearServiceConfig;
  storage?: LinearStorageConfig;
  github?: GithubServiceConfig;
  figma?: FigmaServiceConfig;
};

export type ManagementToolsCore = {
  linear?: ReturnType<typeof createLinearService>;
  storage?: ReturnType<typeof createLinearStorage>;
  github?: ReturnType<typeof createGithubService>;
  figma?: ReturnType<typeof createFigmaService>;
};

export const createManagementToolsCore = (config: CoreConfig): ManagementToolsCore => {
  const logger = config.logger;
  return {
    linear: config.linear ? createLinearService(config.linear) : undefined,
    storage: config.storage ? createLinearStorage(config.storage) : undefined,
    github: config.github ? createGithubService(config.github) : undefined,
    figma: config.figma
      ? createFigmaService({
          ...config.figma,
          logger: config.figma.logger ?? logger,
        })
      : undefined,
  };
};
