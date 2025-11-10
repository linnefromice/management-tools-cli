export const ANALYTICS_ISSUE_FIELDS = [
  "identifier",
  "title",
  "description",
  "priority",
  "priorityLabel",
  "branchName",
  "url",
  "dueDate",
  "estimate",
  "slaBreachesAt",
  "slaHighRiskAt",
  "slaMediumRiskAt",
  "slaStartedAt",
  "snoozedUntilAt",
  "trashed",
  "createdAt",
  "updatedAt",
  "completedAt",
  "archivedAt",
  "autoArchivedAt",
  "autoClosedAt",
  "canceledAt",
  "startedAt",
  "startedTriageAt",
  "triagedAt",
  "addedToCycleAt",
] as const;

export const ANALYTICS_PROJECT_FIELDS = [
  "name",
  "state",
  "status",
  "description",
  "targetDate",
  "startDate",
  "endDate",
  "createdAt",
  "updatedAt",
  "health",
  "color",
  "progress",
  "url",
] as const;

export const ANALYTICS_TEAM_FIELDS = [
  "name",
  "key",
  "description",
  "cycleLength",
  "triageActivated",
  "color",
  "timezone",
  "issueEstimationType",
  "createdAt",
  "updatedAt",
] as const;

export const ANALYTICS_USER_FIELDS = [
  "name",
  "displayName",
  "email",
  "active",
  "admin",
  "avatarUrl",
  "statusEmoji",
  "statusLabel",
  "disabledAt",
  "createdAt",
  "updatedAt",
] as const;

export const ANALYTICS_LABEL_FIELDS = [
  "name",
  "description",
  "color",
  "archivedAt",
  "createdAt",
  "updatedAt",
] as const;

export const ANALYTICS_CYCLE_FIELDS = [
  "name",
  "number",
  "status",
  "description",
  "startsAt",
  "endsAt",
  "completedAt",
  "progress",
  "createdAt",
  "updatedAt",
] as const;

export const ANALYTICS_FIELD_WHITELIST: Record<string, readonly string[]> = {
  issues: ANALYTICS_ISSUE_FIELDS,
  projects: ANALYTICS_PROJECT_FIELDS,
  teams: ANALYTICS_TEAM_FIELDS,
  users: ANALYTICS_USER_FIELDS,
  labels: ANALYTICS_LABEL_FIELDS,
  cycles: ANALYTICS_CYCLE_FIELDS,
};
