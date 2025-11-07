# AGENTS

## Project Context
- CLI unifies day-to-day management workflows in a single terminal-first interface.
- Primary integrations: Linear for issue tracking and Notion for knowledge/tasks.
- Use official APIs or SDKs from each service; do not scrape or rely on unofficial endpoints.

## Agent Expectations
- Default runtime/tooling is Bun (see `CLAUDE.md`); prefer `bun run`, `bun test`, and Bun-native APIs.
- Keep integration boundaries clean: isolate Linear-specific and Notion-specific code to dedicated modules to simplify auth and future expansion.
- Model commands around core flows (e.g., syncing tasks, creating issues, mirroring statuses) so the CLI offers consistent verbs across services.
- Cache remote data conservatively and document assumptions about eventual consistency between providers.

## Implementation Notes
- Establish shared abstractions for auth + HTTP transport so new tools can be added with minimal boilerplate.
- Honor rate limits by queuing or backoff logic; surface actionable errors to the user (display provider + action + hint).
- When multiple services support a feature (e.g., tasks), normalize fields (id, title, status, assignee) before presenting in the CLI.
- Prefer configuration via env vars (`LINEAR_API_KEY`, `NOTION_TOKEN`, etc.) and document required scopes.

## Future Extensions
- Add telemetry hooks to understand which commands are used most, informing next integrations.
- Consider pluggable adapters so community contributions can add Jira, Asana, etc. without modifying the core.
