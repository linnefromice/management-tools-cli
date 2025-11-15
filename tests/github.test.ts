import { describe, expect, test } from "bun:test";
import type { GithubPullRequestReviewerSummary, GithubPullRequestSummary } from "../src/github";
import { buildReviewStatusEntries } from "../src/github";

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
