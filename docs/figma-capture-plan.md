# Figma Capture Command Implementation Plan

## 1. CLI UX and Command Routing
- Add a `figma capture` subcommand in `index.ts` that reuses shared flag helpers (`parseOutputFormat`, `getPositionalArgs`, etc.).
- Require a single positional node reference (raw node-id or full Figma URL); optional flags `--format png|jpg`, `--scale <1-4>`, and `--output <path>`.
- Validate inputs and throw `CliUsageError` for misuse so the existing usage handler shows a helpful message.

## 2. Configuration Surface
- Introduce `FIGMA_ACCESS_TOKEN`, `FIGMA_FILE_KEY`, and `FIGMA_MCP_ENDPOINT` constants (env-driven with defaults) in a dedicated `src/config/figma.ts` or `src/constants.ts`.
- Document expected env vars/scopes and keep the token/file key treated as “constants” per the request while allowing overrides for deployments.

## 3. Figma Client Module
- Create `src/figma.ts` to wrap MCP calls: normalize input (extract node-id from URLs, decode `%3A`), build the JSON-RPC payload for `tools/call` → `get_image`, and send it with Bun’s native `fetch`.
- Handle MCP/Figma errors with actionable messages that include provider + action + hint; implement simple retry/backoff to respect rate limits.
- Decode the `data:image/...;base64,...` payload into binary for downstream use.

## 4. Output Handling
- Extend `src/output.ts` helpers or add a small utility so the command can print metadata via `printPayload` or write binary files.
- Default output path: `storage/figma/<timestamp>.png|jpg` unless `--output` overrides it; ensure directories are created as needed.
- Return structured JSON (nodeId, format, savedPath, source) when stdout is selected, matching existing CLI patterns.

## 5. Documentation and Tests
- Update `README.md` (and `AGENTS.md`/`CLAUDE.md` if they list commands) with setup steps: install/start `@figma/mcp-server`, required env vars, and command examples.
- Add at least one automated test under `tests/` that mocks the MCP response to verify URL → node-id parsing and output handling.
- Mention future extensions (e.g., caching, `get_code`) in docs if relevant.
