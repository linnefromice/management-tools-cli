import { Octokit } from "@octokit/rest";

const requireEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
};

type RepositoryConfig = {
  owner: string;
  repo: string;
};

export type PullRequestQueryOptions = {
  state?: "open" | "closed" | "all";
  limit?: number;
  createdAfter?: Date;
  createdBefore?: Date;
  updatedAfter?: Date;
  updatedBefore?: Date;
};

export type GithubPullRequestReviewerSummary = {
  type: "USER" | "TEAM";
  login: string;
  name?: string;
  state: string;
  submittedAt?: string;
  avatarUrl?: string;
};

export type GithubPullRequestSummary = {
  number: number;
  title: string;
  url: string;
  state: string;
  draft: boolean;
  author?: string;
  createdAt: string;
  updatedAt: string;
  mergedAt?: string;
  headRef: string;
  baseRef: string;
  reviewers: GithubPullRequestReviewerSummary[];
  reviewSummary: {
    approved: number;
    changesRequested: number;
    commented: number;
    dismissed: number;
    pending: number;
    total: number;
    overallStatus: "approved" | "changes_requested" | "pending" | "no_reviews";
  };
};

export type GithubPullRequestListResult = {
  repository: string;
  fetchedAt: string;
  count: number;
  pullRequests: GithubPullRequestSummary[];
};

export type GithubReviewStatusEntry = {
  number: number;
  title: string;
  titleIncludesWip: boolean;
  draft: boolean;
  author?: string;
  reviewers: Record<string, string>;
  updatedAt: string;
};

export type GithubReviewStatusResult = {
  repository: string;
  fetchedAt: string;
  windowStart: string;
  count: number;
  pullRequests: GithubReviewStatusEntry[];
};

let octokit: Octokit | null = null;

const getOctokit = () => {
  if (!octokit) {
    octokit = new Octokit({
      auth: requireEnv("GITHUB_TOKEN"),
    });
  }
  return octokit;
};

export const resolveGithubRepository = (): RepositoryConfig => {
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

  throw new Error(
    "Missing repository configuration. Set GITHUB_OWNER and GITHUB_REPO or a combined GITHUB_REPOSITORY value.",
  );
};

type RestPullRequest = Awaited<ReturnType<Octokit["rest"]["pulls"]["list"]>>["data"][number];

const matchesDateFilters = (
  pullRequest: RestPullRequest,
  filters: PullRequestQueryOptions,
): boolean => {
  const createdAt = new Date(pullRequest.created_at);
  const updatedAt = new Date(pullRequest.updated_at);

  if (filters.createdAfter && createdAt < filters.createdAfter) return false;
  if (filters.createdBefore && createdAt > filters.createdBefore) return false;
  if (filters.updatedAfter && updatedAt < filters.updatedAfter) return false;
  if (filters.updatedBefore && updatedAt > filters.updatedBefore) return false;

  return true;
};

const reviewerKey = (type: "USER" | "TEAM", login: string) => `${type}:${login}`;

type ReviewRequestData = Awaited<
  ReturnType<Octokit["rest"]["pulls"]["listRequestedReviewers"]>
>["data"];

type ReviewData = Awaited<ReturnType<Octokit["rest"]["pulls"]["listReviews"]>>["data"];

const aggregateReviewers = (
  requestedUsers: ReviewRequestData["users"],
  requestedTeams: ReviewRequestData["teams"],
  reviews: ReviewData,
): GithubPullRequestReviewerSummary[] => {
  const map = new Map<string, GithubPullRequestReviewerSummary>();

  const upsertReviewer = (reviewer: GithubPullRequestReviewerSummary) => {
    const key = reviewerKey(reviewer.type, reviewer.login);
    const existing = map.get(key);

    if (!existing) {
      map.set(key, reviewer);
      return;
    }

    const existingTime = existing.submittedAt ? Date.parse(existing.submittedAt) : -Infinity;
    const incomingTime = reviewer.submittedAt ? Date.parse(reviewer.submittedAt) : -Infinity;

    if (!reviewer.submittedAt) {
      if (!existing.submittedAt) {
        map.set(key, reviewer);
      }
      return;
    }

    if (!existing.submittedAt || incomingTime >= existingTime) {
      map.set(key, { ...existing, ...reviewer });
    }
  };

  requestedUsers.forEach((user) => {
    upsertReviewer({
      type: "USER",
      login: user.login,
      name: user.name ?? undefined,
      state: "REVIEW_REQUESTED",
      avatarUrl: user.avatar_url ?? undefined,
    });
  });

  requestedTeams.forEach((team) => {
    upsertReviewer({
      type: "TEAM",
      login: team.slug ?? team.name,
      name: team.name,
      state: "REVIEW_REQUESTED",
    });
  });

  reviews.forEach((review) => {
    const login = review.user?.login;
    if (!login) return;

    upsertReviewer({
      type: "USER",
      login,
      name: review.user?.name ?? undefined,
      state: review.state ?? "COMMENTED",
      submittedAt: review.submitted_at ?? undefined,
      avatarUrl: review.user?.avatar_url ?? undefined,
    });
  });

  return Array.from(map.values()).sort((a, b) => a.login.localeCompare(b.login));
};

const buildReviewSummary = (
  reviewers: GithubPullRequestReviewerSummary[],
): GithubPullRequestSummary["reviewSummary"] => {
  const summary = {
    approved: 0,
    changesRequested: 0,
    commented: 0,
    dismissed: 0,
    pending: 0,
  };

  reviewers.forEach((reviewer) => {
    const state = reviewer.state ? reviewer.state.toUpperCase() : "";
    switch (state) {
      case "APPROVED":
        summary.approved += 1;
        break;
      case "CHANGES_REQUESTED":
        summary.changesRequested += 1;
        break;
      case "COMMENTED":
        summary.commented += 1;
        break;
      case "DISMISSED":
        summary.dismissed += 1;
        break;
      default:
        summary.pending += 1;
        break;
    }
  });

  let overallStatus: GithubPullRequestSummary["reviewSummary"]["overallStatus"] = "no_reviews";
  if (summary.changesRequested > 0) {
    overallStatus = "changes_requested";
  } else if (summary.pending > 0) {
    overallStatus = "pending";
  } else if (summary.approved > 0) {
    overallStatus = "approved";
  }

  return {
    ...summary,
    total:
      summary.approved +
      summary.changesRequested +
      summary.commented +
      summary.dismissed +
      summary.pending,
    overallStatus,
  };
};

const enrichPullRequest = async (
  pullRequest: RestPullRequest,
  repository: RepositoryConfig,
): Promise<GithubPullRequestSummary> => {
  const client = getOctokit();

  const [reviewRequests, reviews] = await Promise.all([
    client.rest.pulls.listRequestedReviewers({
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequest.number,
      per_page: 100,
    }),
    client.paginate(client.rest.pulls.listReviews, {
      owner: repository.owner,
      repo: repository.repo,
      pull_number: pullRequest.number,
      per_page: 100,
    }),
  ]);

  const reviewers = aggregateReviewers(
    reviewRequests.data.users,
    reviewRequests.data.teams,
    reviews,
  );

  return {
    number: pullRequest.number,
    title: pullRequest.title,
    url: pullRequest.html_url,
    state: pullRequest.state,
    draft: Boolean(pullRequest.draft),
    author: pullRequest.user?.login ?? undefined,
    createdAt: pullRequest.created_at,
    updatedAt: pullRequest.updated_at,
    mergedAt: pullRequest.merged_at ?? undefined,
    headRef: pullRequest.head?.ref ?? "",
    baseRef: pullRequest.base?.ref ?? "",
    reviewers,
    reviewSummary: buildReviewSummary(reviewers),
  };
};

export const fetchRepositoryPullRequests = async (
  options: PullRequestQueryOptions = {},
): Promise<GithubPullRequestListResult> => {
  const repository = resolveGithubRepository();
  const client = getOctokit();
  const limit = Math.max(1, options.limit ?? 20);
  const perPage = Math.min(Math.max(limit, 1), 100);

  const basePullRequests: RestPullRequest[] = [];

  const iterator = client.paginate.iterator(client.rest.pulls.list, {
    owner: repository.owner,
    repo: repository.repo,
    state: options.state ?? "open",
    per_page: perPage,
    sort: "updated",
    direction: "desc",
  });

  outer: for await (const response of iterator) {
    for (const pullRequest of response.data) {
      if (!matchesDateFilters(pullRequest, options)) {
        continue;
      }
      basePullRequests.push(pullRequest);
      if (basePullRequests.length >= limit) {
        break outer;
      }
    }
  }

  const pullRequests = await Promise.all(
    basePullRequests.map((pullRequest) => enrichPullRequest(pullRequest, repository)),
  );

  return {
    repository: `${repository.owner}/${repository.repo}`,
    fetchedAt: new Date().toISOString(),
    count: pullRequests.length,
    pullRequests,
  };
};

const WIP_REGEX = /\bwip\b/i;

const mapReviewersToState = (reviewers: GithubPullRequestReviewerSummary[]) => {
  const mapping: Record<string, string> = {};
  reviewers.forEach((reviewer) => {
    mapping[reviewer.login] = reviewer.state;
  });
  return mapping;
};

export const fetchRecentReviewStatus = async (
  options: { windowDays?: number; limit?: number } = {},
): Promise<GithubReviewStatusResult> => {
  const windowDays = options.windowDays ?? 7;
  const updatedAfter = new Date(Date.now() - windowDays * 24 * 60 * 60 * 1000);

  const base = await fetchRepositoryPullRequests({
    state: "open",
    limit: options.limit ?? 50,
    updatedAfter,
  });

  return {
    repository: base.repository,
    fetchedAt: base.fetchedAt,
    windowStart: updatedAfter.toISOString(),
    count: base.count,
    pullRequests: base.pullRequests.map((pullRequest) => ({
      number: pullRequest.number,
      title: pullRequest.title,
      titleIncludesWip: WIP_REGEX.test(pullRequest.title),
      draft: pullRequest.draft,
      author: pullRequest.author,
      reviewers: mapReviewersToState(pullRequest.reviewers),
      updatedAt: pullRequest.updatedAt,
    })),
  };
};
