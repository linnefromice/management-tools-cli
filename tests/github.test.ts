import { describe, expect, test } from "bun:test";
import type {
  GithubPullRequestReviewerSummary,
  GithubPullRequestSummary,
  GithubReviewStatusEntry,
} from "../packages/core/src/github";
import {
  buildReviewStatusEntries,
  __test__ as githubTestUtils,
} from "../packages/core/src/github";

const makeReviewer = (
  overrides: Partial<GithubPullRequestReviewerSummary> & { login: string },
): GithubPullRequestReviewerSummary => ({
  type: overrides.type ?? "USER",
  login: overrides.login,
  state: overrides.state ?? "REVIEW_REQUESTED",
  name: overrides.name,
  avatarUrl: overrides.avatarUrl,
  submittedAt: overrides.submittedAt,
});

const makePullRequest = (
  overrides: Partial<GithubPullRequestSummary>,
): GithubPullRequestSummary => ({
  number: overrides.number ?? 42,
  title: overrides.title ?? "Add reports page",
  url: overrides.url ?? "https://example.com/pr/42",
  state: overrides.state ?? "open",
  draft: overrides.draft ?? false,
  author: overrides.author ?? "test-user",
  createdAt: overrides.createdAt ?? "2025-01-01T00:00:00Z",
  updatedAt: overrides.updatedAt ?? "2025-01-02T00:00:00Z",
  mergedAt: overrides.mergedAt,
  headRef: overrides.headRef ?? "feat/reports",
  baseRef: overrides.baseRef ?? "main",
  labels: overrides.labels ?? [],
  reviewers: overrides.reviewers ?? [
    makeReviewer({ login: "alice", state: "APPROVED" }),
    makeReviewer({ login: "bob", state: "REVIEW_REQUESTED" }),
  ],
  reviewSummary: overrides.reviewSummary ?? {
    approved: 1,
    changesRequested: 0,
    commented: 0,
    dismissed: 0,
    pending: 1,
    total: 2,
    overallStatus: "pending",
  },
});

describe("buildReviewStatusEntries", () => {
  test("maps pull request fields into trimmed review status entries", () => {
    const pullRequests = [
      makePullRequest({
        number: 7,
        title: "[WIP] Align mobile dashboard",
        draft: true,
        author: "alice-dev",
        updatedAt: "2025-01-06T10:00:00Z",
        labels: ["needs-design", "mobile"],
        reviewers: [
          makeReviewer({ login: "bruno", state: "REVIEW_REQUESTED" }),
          makeReviewer({ login: "casey", state: "APPROVED" }),
        ],
      }),
      makePullRequest({
        number: 9,
        title: "Polish settings form",
        draft: false,
        author: "bob-dev",
        updatedAt: "2025-01-07T08:00:00Z",
        labels: [],
        reviewers: [makeReviewer({ login: "drew", state: "COMMENTED" })],
      }),
    ];

    const entries = buildReviewStatusEntries(pullRequests);

    expect(entries).toHaveLength(2);
    expect(entries[0]).toEqual({
      number: 7,
      title: "[WIP] Align mobile dashboard",
      titleIncludesWip: true,
      draft: true,
      author: "alice-dev",
      updatedAt: "2025-01-06T10:00:00Z",
      labels: ["needs-design", "mobile"],
      reviewers: {
        bruno: "REVIEW_REQUESTED",
        casey: "APPROVED",
      },
    });

    expect(entries[1]).toEqual({
      number: 9,
      title: "Polish settings form",
      titleIncludesWip: false,
      draft: false,
      author: "bob-dev",
      updatedAt: "2025-01-07T08:00:00Z",
      labels: [],
      reviewers: {
        drew: "COMMENTED",
      },
    });
  });
});

describe("mapCommitToSummary", () => {
  const { mapCommitToSummary } = githubTestUtils;
  const repository = { owner: "acme", repo: "mobile-app" };

  test("includes owner/repo and author metadata", () => {
    const commit = {
      sha: "abc123",
      commit: {
        message: "Fix crash on login\n\nDetailed explanation",
        author: {
          name: "Alice Dev",
          email: "alice@example.com",
          date: "2025-01-10T12:00:00Z",
        },
        verification: { verified: true },
      },
      html_url: "https://github.com/acme/mobile-app/commit/abc123",
      author: {
        login: "alice-dev",
        avatar_url: "https://avatars.example.com/alice.png",
      },
      parents: [{ sha: "parent-1" }, { sha: "parent-2" }],
    } as unknown as Parameters<typeof mapCommitToSummary>[0];

    const summary = mapCommitToSummary(commit, repository);

    expect(summary).toEqual({
      owner: "acme",
      repo: "mobile-app",
      sha: "abc123",
      shortMessage: "Fix crash on login",
      message: "Fix crash on login\n\nDetailed explanation",
      url: "https://github.com/acme/mobile-app/commit/abc123",
      authorLogin: "alice-dev",
      authorName: "Alice Dev",
      authorEmail: "alice@example.com",
      authorAvatarUrl: "https://avatars.example.com/alice.png",
      committedAt: "2025-01-10T12:00:00Z",
      parents: ["parent-1", "parent-2"],
      verified: true,
    });
  });

  test("falls back to committer date/login when data is missing", () => {
    const commit = {
      sha: "def456",
      commit: {
        message: "Chore: update workflows",
        committer: {
          date: "2025-01-11T08:30:00Z",
        },
      },
      author: {
        login: "bot-user",
      },
      parents: [],
    } as unknown as Parameters<typeof mapCommitToSummary>[0];

    const summary = mapCommitToSummary(commit, repository);

    expect(summary).toMatchObject({
      owner: "acme",
      repo: "mobile-app",
      sha: "def456",
      shortMessage: "Chore: update workflows",
      message: "Chore: update workflows",
      authorLogin: "bot-user",
      authorName: "bot-user",
      committedAt: "2025-01-11T08:30:00Z",
      parents: [],
    });
  });
});

describe("filterReadyReviewEntries", () => {
  const { filterReadyReviewEntries } = githubTestUtils;

  test("removes entries marked as draft or WIP", () => {
    const entries: GithubReviewStatusEntry[] = [
      {
        number: 1,
        title: "Ready PR",
        titleIncludesWip: false,
        draft: false,
        author: "alice",
        reviewers: {},
        updatedAt: "2025-01-10T10:00:00Z",
        labels: [],
      },
      {
        number: 2,
        title: "[WIP] Refactor",
        titleIncludesWip: true,
        draft: false,
        author: "bob",
        reviewers: {},
        updatedAt: "2025-01-10T12:00:00Z",
        labels: [],
      },
      {
        number: 3,
        title: "Draft PR",
        titleIncludesWip: false,
        draft: true,
        author: "casey",
        reviewers: {},
        updatedAt: "2025-01-10T14:00:00Z",
        labels: [],
      },
    ];

    const filtered = filterReadyReviewEntries(entries);
    expect(filtered).toEqual([entries[0]!]);
  });
});
