# management-tools-cli

CLI + SDK workspace for day-to-day Linear / GitHub / Figma workflows.

_日本語版 README は [README.ja.md](./README.ja.md) を参照してください。_

- `packages/core`: provider-agnostic services + shared types for embedding in other tools.
- `packages/cli`: terminal UX that wires the services to commands, output helpers, and storage.

## Installation

```bash
bun install
```

This installs dependencies for every workspace package.

## Running the CLI

All commands are still routed through the repo root entry point, so previous scripts continue to work:

```bash
bun run index.ts --help
bun run index.ts linear projects --remote
```

You can also target the CLI package scripts directly:

```bash
# run tests / lint / typecheck scoped to the CLI package
bun run --filter management-tools-cli test
bun run --filter management-tools-cli typecheck

# build standalone binary into dist/mng-tool
bun run --filter management-tools-cli build:binary
```

The compiled binary bundles Bun, so you can distribute `dist/mng-tool` without requiring Bun on the target host.

## Project structure

```
packages/
  core/   # SDK-style modules for Linear, GitHub, Figma, storage, time helpers, etc.
  cli/    # Commander-style CLI using the core packages
dist/     # Bundled JS + standalone binary (after build)
storage/  # Local Linear cache (populated at runtime)
tests/    # Shared Bun test suite covering both packages
```

Use `@mng-tool/core` when building another CLI/SDK. Example:

```ts
import { createLinearService } from "@mng-tool/core";

const linear = createLinearService({
  apiKey: process.env.LINEAR_API_KEY!,
  workspaceId: process.env.LINEAR_WORKSPACE_ID,
});

const projects = await linear.fetchWorkspaceProjects();
```

The CLI consumes the same packages via `packages/cli/src/index.ts`, so new provider capabilities should start in `packages/core` and then be exposed via commands.

## Quickstart

```bash
# linear
## Search issues
bun run index.ts linear sync
bun run index.ts linear search-issues

# figma
## capture design data as image file
bun run index.ts figma capture 8802-46326 --format png --output image

# github review-status
bun run index.ts github review-status --ready-only

# github commits
## 1day
bun run index.ts github commits --user linnefromice --days 1 --window-boundary 202511150000 --timezone Asia/Tokyo
## week
bun run index.ts github commits --user linnefromice --days 5 --window-boundary 202511150000 --timezone Asia/Tokyo
```

## Environment variables

Bun automatically loads variables from a local `.env` file. Copy `.env.example` to `.env` and set:

```env
LINEAR_API_KEY=lin_api_xxx
LINEAR_WORKSPACE_ID=<workspace-uuid>
```

These are required for `linear-projects` to authenticate against the correct workspace via the Linear SDK.

For the new Figma capture workflow also set:

```env
FIGMA_ACCESS_TOKEN=figd_xxx
# Optional override (defaults to https://api.figma.com)
FIGMA_API_BASE_URL=https://api.figma.com
```

`FIGMA_ACCESS_TOKEN` must have the "File export" scope. File keys must be specified explicitly in your configuration files (.txt or .json) - see the Figma section below for details.

For GitHub automation configure:

```env
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
# or instead of the last two:
# GITHUB_REPOSITORY=your-org/your-repo
```

`GITHUB_TOKEN` needs `repo` scope (and `read:org` if you fetch from private org repos). The CLI resolves the repository from either the split owner/repo variables or the combined `GITHUB_REPOSITORY`.

### Building + releasing binaries

Run the workspace script to build and test before releasing:

```bash
bun run --filter management-tools-cli check-and-build
```

This executes lint/format/typecheck/tests, compiles `dist/mng-tool`, and copies `.env` for the runtime.

GitHub tags that follow `v*` trigger `.github/workflows/release-binary.yml`, which performs the same Linux build in CI and uploads `dist/mng-tool-linux` to the release artifacts.

## CLI commands

### Linear

After configuring env vars you can inspect Linear data via subcommands:

| Command                                 | Description                                                                                                         | Useful flags                                                                                                                                         |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run index.ts linear projects`      | List projects from local cache by default                                                                           | `--full` (raw payload), `--format csv`, `--remote` (refresh cache via API), `--output [path]`, `--all-fields` (emit every attribute, skip filtering) |
| `bun run index.ts linear teams`         | List teams                                                                                                          | `--full`, `--format csv`, `--remote`, `--output [path]`, `--all-fields`                                                                              |
| `bun run index.ts linear issue <KEY>`   | Retrieve a single issue (from local storage) by key such as `CORE-123`                                              | `--format csv`, `--output [path]`, `--all-fields`                                                                                                    |
| `bun run index.ts linear issues`        | List issues from cache                                                                                              | `--format csv`, `--remote`, `--output [path]`, `--all-fields`                                                                                        |
| `bun run index.ts linear users`         | List members                                                                                                        | `--format csv`, `--remote`, `--output [path]`, `--all-fields`                                                                                        |
| `bun run index.ts linear labels`        | List issue labels                                                                                                   | `--format csv`, `--remote`, `--output [path]`, `--all-fields`                                                                                        |
| `bun run index.ts linear cycles`        | List cycles                                                                                                         | `--format csv`, `--remote`, `--output [path]`, `--all-fields`                                                                                        |
| `bun run index.ts linear search-issues` | Query issues already synced to disk                                                                                 | `--project <id>`, `--label <id>`, `--cycle <id>`, `--format csv`, `--output [path]`, `--all-fields`                                                  |
| `bun run index.ts linear sync`          | Download teams, projects, issues, users, labels, cycles and store them under `storage/linear/` for offline analysis | —                                                                                                                                                    |

> ヒント: `--remote` を付けると対象データを Linear API から再取得し、ローカルの `storage/linear/*.json` も自動更新します。指定しない場合は最新のローカルキャッシュを読み込みます。

### GitHub

Once `GITHUB_TOKEN` and repository env vars are in place you can inspect pull requests and commits directly from GitHub:

| Command                                          | Description                                                                                           | Useful flags                                                                                                                                                                                                                                                      |
| ------------------------------------------------ | ----------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `bun run index.ts github prs`                    | Lists pull requests for the configured repository, including reviewer assignments/statuses and labels | `--state open\|closed\|all`, `--limit <N>` (default 20, max 200), `--created-after/--created-before <ISO>`, `--updated-after/--updated-before <ISO>`                                                                                                              |
| `bun run index.ts github review-status`          | Highlights open PRs updated within the last 7 days, focusing on reviewer states + labels              | `--limit <N>` (default 50), `--ready-only`, `--format csv`, `--output [path]`, `--all-fields`                                                                                                                                                                     |
| `bun run index.ts github commits --user <login>` | Fetches commits authored by the specified user within the recent N-day window (default 7 days)        | `--user <login>` (required), `--days <N>` (default 7), `--window-boundary <YYYYMMDD[HHMM]>`, `--timezone <IANA\|±HHMM>`, `--limit <N>` (default 40, max 200), `--owner <org> --repo <name>` (override env), `--exclude-merges`, `--format csv`, `--output [path]` |

#### `github prs` details

This command mirrors the GitHub PR list endpoint and enriches each entry with:

- `number`, `title`, `state`, `draft`, `author`, `headRef`, `baseRef`, `url`
- Timestamps (`createdAt`, `updatedAt`, `mergedAt`)
- `labels`: array of label names on the PR
- `reviewers`: the latest reviewer roster with state + metadata
- `reviewSummary`: counts of approved/changes-requested/commented/dismissed/pending reviews plus `overallStatus`

Example:

```json
{
  "number": 52,
  "title": "[WIP] Align mobile dashboard cards",
  "state": "open",
  "draft": true,
  "author": "alice-dev",
  "labels": ["needs-design", "mobile"],
  "createdAt": "2025-01-04T12:20:37Z",
  "updatedAt": "2025-01-10T08:50:24Z",
  "headRef": "feat/mobile-dashboard",
  "baseRef": "main",
  "reviewSummary": {
    "approved": 0,
    "changesRequested": 0,
    "commented": 0,
    "dismissed": 0,
    "pending": 3,
    "total": 3,
    "overallStatus": "pending"
  },
  "reviewers": [
    { "type": "USER", "login": "bruno-qa", "state": "REVIEW_REQUESTED" },
    { "type": "USER", "login": "casey-ios", "state": "REVIEW_REQUESTED" },
    { "type": "USER", "login": "drew-design", "state": "REVIEW_REQUESTED" }
  ]
}
```

Use `--state`/`--limit`/`--created-after`/`--updated-after` to focus on specific slices, then pipe the structured JSON or CSV downstream.

#### `github review-status` details

This reporter is optimized for daily standups. It automatically:

- Filters to `state=open` and `updatedAt >= now - 7 days`
- Emits minimal fields: `number`, `title`, `titleIncludesWip`, `draft`, `author`, `updatedAt`, `labels`, and a reviewer state map `{ login: "APPROVED" | "REVIEW_REQUESTED" | ... }`
- Honors `--limit`, `--format`, `--output`, and `--all-fields` (to include unfiltered payloads if needed)

Example row:

```json
{
  "number": 52,
  "title": "[WIP] Align mobile dashboard cards",
  "titleIncludesWip": true,
  "draft": true,
  "author": "alice-dev",
  "updatedAt": "2025-01-10T08:50:24Z",
  "labels": ["needs-design", "mobile"],
  "reviewers": {
    "bruno-qa": "REVIEW_REQUESTED",
    "casey-ios": "REVIEW_REQUESTED",
    "drew-design": "REVIEW_REQUESTED"
  }
}
```

Examples:

```bash
# Show the latest 10 open PRs updated this week
bun run index.ts github prs --limit 10 --updated-after 2024-11-01T00:00:00Z

# Export closed PRs created in October to CSV
bun run index.ts github prs --state closed --created-after 2024-10-01T00:00:00Z \
  --created-before 2024-11-01T00:00:00Z --format csv --output ./outputs/github/prs-oct.csv

# See which open PRs still need reviews (updated in the past week)
bun run index.ts github review-status

# See last week's commits authored by @alice-dev
bun run index.ts github commits --user alice-dev

# Capture the last 3 days of commits from @reviewer into CSV
bun run index.ts github commits --user reviewer --days 3 --limit 100 --format csv \
  --output ./outputs/github/reviewer-commits.csv

# Query commits from a different repo/org and drop merges
bun run index.ts github commits --user alice-dev --owner acme --repo infra \
  --exclude-merges --limit 50

# Capture a full work week of commits anchored to JST midnight
bun run index.ts github commits --user alice-dev --days 5 \
  --window-boundary 202405310000 --timezone Asia/Tokyo
```

Each entry includes the reviewer roster with their most recent review state plus an aggregate `reviewSummary` (`approved`, `pending`, `changes_requested`, etc.).

`github review-status` outputs only the essentials for triage—`number`, `title`, `titleIncludesWip`, `draft`, `author`, `updatedAt`, `labels`, and a `{ [login]: state }` reviewer map—so you can scan who’s blocking each PR without extra noise. It automatically filters to open PRs touched within the last 7 days, and `--ready-only` additionally hides drafts or titles containing “WIP” so you focus on PRs ready for review.

### `github commits` details

This command wraps `GET /repos/{owner}/{repo}/commits` with an `author` filter. By default it looks back 7 days (configurable via `--days`) and caps the response to the requested limit. Pass `--owner <org> --repo <name>` to override the repository derived from `GITHUB_OWNER/GITHUB_REPO`, and add `--exclude-merges` to skip merge commits (parent count > 1). Use `--window-boundary <YYYYMMDD[HHMM]>` together with `--timezone <IANA\|±HHMM>` to anchor the window to a precise local midnight (e.g., `202405310000` in `Asia/Tokyo`).

Default output keeps each commit lean with just the fields needed for weekly summaries:

- `owner`
- `repo`
- `sha`
- `message`
- `authorLogin`
- `committedAt`
- `parents`

When you specify window alignment flags the payload also echoes `windowDays`, `windowBoundary`, and `timeZone` so downstream analysis can reason about the exact slice.

Add `--all-fields` when you need the expanded payload (URL, author profile/ email, verification state, etc.).

Example output:

```json
{
  "repository": "acme/mobile-app",
  "owner": "acme",
  "repo": "mobile-app",
  "author": "alice-dev",
  "fetchedAt": "2025-01-11T09:15:00.000Z",
  "since": "2025-01-04T09:15:00.000Z",
  "until": "2025-01-11T09:15:00.000Z",
  "windowDays": 7,
  "windowBoundary": "2025-01-11T00:00:00.000Z",
  "timeZone": "Asia/Tokyo",
  "count": 2,
  "commits": [
    {
      "owner": "acme",
      "repo": "mobile-app",
      "sha": "abc1234",
      "message": "Fix crash on login\\n\\nThe regression...",
      "authorLogin": "alice-dev",
      "committedAt": "2025-01-10T18:42:11Z",
      "parents": ["def5678"]
    }
  ]
}
```

`owner`/`repo` mirror the repository context resolved for the command, ensuring logs remain clear even if you capture multiple repositories.

### Output formats

All list-style commands default to pretty JSON. Add `--format csv` to emit a CSV table (helpful when piping to spreadsheets or passing a compact prompt into an LLM). CSV conversion requires the command to know which collection to print; that is handled automatically when `--format csv` is supported.

By default, outputs contain only analytics-friendly attributes (content, timestamps, etc.) so LLM prompts stay compact. Pass `--all-fields` to any Linear command to disable the filter and dump the full dataset as stored on disk.

### File output

- すべての参照系コマンドは `--output` フラグに対応しています。`--output /path/to/file.csv` のように指定すると標準出力に加えてファイルにも書き出します。
- パスを省略して `--output` だけ指定した場合は `storage/exports/<command>-YYYY-MM-DDTHH-MM-SS.<ext>` のようなユニークなファイルを自動生成します（`<ext>` は `--format` に応じて `.csv` か `.json`）。
- データはそのまま LLM への入力や分析の下準備として活用できます。

### Local storage workflow

1. Run `bun run index.ts linear sync` to refresh cached JSON files (`storage/linear/*.json`).
2. Use `linear issue <KEY>` or `linear search-issues` with filters (optionally `--output` + `--format csv`) to query the cached data without hitting the API.
3. These local datasets become the source of truth for LLM prompt generation, diffing, or additional offline tooling.

## Testing

```bash
bun test          # run all tests
bun test --coverage
bun run lint
bun run typecheck
```

CI-style scripts ensure the CLI, storage helpers, and output utilities behave consistently before sharing data with downstream automation.

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.

## Figma capture workflow

Use the Figma REST API to download rendered node images directly from the CLI.

```bash
bun run index.ts figma capture --ids-file <PATH> \
  [--scale 2] \
  [--format png] \
  [--output ./custom/path.png]
```

- `--ids-file` is **required** and must point to a configuration file (`.json` or `.txt`):
  - **JSON format** (recommended): Specify individual `fileKey` and `nodeId` pairs, or full URLs. See `examples/figma-nodes.json`.
  - **TXT format**: Each line must be either `FILE_KEY#NODE_ID` or a full Figma URL. See `examples/figma-node-ids.txt`.
- The command groups nodes by file key and batches them into `GET /v1/images/<FILE_KEY>?ids=<...>` requests, downloads each signed URL, and writes images under `outputs/figma/<timestamp>/`.
- Each execution creates a new timestamped folder (e.g., `outputs/figma/2025-11-12T02-01-00-895Z/`).
- Output filenames follow `figma-design-${file-key}-${node-id-with-hyphen}.${format}` (e.g., `figma-design-fl5uK43wSluXQiL7vVHjFq-7760-56939.png`).
- Add `--output` to override the path when capturing a single node.
- `--scale` accepts integers `1-4`; `--format` supports `png` or `jpg`.

### Logging

The Figma capture command includes detailed logging for API requests and file downloads. Set the `LOG_LEVEL` environment variable to control verbosity:

```bash
# Default: INFO level (shows API requests, downloads, and file writes)
bun run index.ts figma capture --ids-file ./examples/figma-node-ids.txt

# DEBUG level (includes additional details like headers, node IDs, buffer sizes)
LOG_LEVEL=debug bun run index.ts figma capture --ids-file ./examples/figma-node-ids.txt

# WARN level (only warnings and errors)
LOG_LEVEL=warn bun run index.ts figma capture --ids-file ./examples/figma-node-ids.txt
```

Available log levels: `debug`, `info` (default), `warn`, `error`.

Example log output (INFO level):

```
[2025-11-12T03:26:08.812Z] [INFO] Starting Figma capture process
[2025-11-12T03:26:08.813Z] [INFO] GET https://api.figma.com/v1/images/...
[2025-11-12T03:26:09.563Z] [INFO] GET ... - 200 OK (750ms)
[2025-11-12T03:26:09.564Z] [INFO] Downloading image from https://...
[2025-11-12T03:26:10.520Z] [INFO] Downloaded image (1273.74 KB) in 956ms
[2025-11-12T03:26:13.437Z] [INFO] Writing file: /path/to/output.png
[2025-11-12T03:26:13.443Z] [INFO] Saved 8802:46326 (1273.74 KB) to /path/to/output.png
[2025-11-12T03:26:13.443Z] [INFO] Capture completed: 1 file(s) saved
```

### Configuration file formats

#### JSON format (recommended)

The JSON format allows you to specify a `fileKey` for each node individually, enabling captures across multiple Figma files in a single command:

```json
[
  {
    "fileKey": "fl5uK43wSluXQiL7vVHjFq",
    "nodeId": "8802:46326"
  },
  {
    "url": "https://www.figma.com/design/anotherFileKey/Project?node-id=7760-56939&m=dev"
  }
]
```

- Each entry must specify **either**:
  - Both `fileKey` and `nodeId`: Explicit file and node IDs (both required)
  - `url`: Full Figma URL (file key and node ID extracted automatically)
- Store this as `examples/figma-nodes.json` and use `--ids-file ./examples/figma-nodes.json`

#### TXT format

The TXT format supports one entry per line with the following formats:

```
# ios onboarding flows
fl5uK43wSluXQiL7vVHjFq#8802:46326
https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Project?node-id=7760-56939
```

- Lines starting with `#` are ignored as comments
- Each line must be **either**:
  - `FILE_KEY#NODE_ID` format (e.g., `fl5uK43wSluXQiL7vVHjFq#8802:46326`)
  - Full Figma URL (file key and node ID extracted automatically)
- Store this as `examples/figma-node-ids.txt` and use `--ids-file ./examples/figma-node-ids.txt`

Both formats will save images under `outputs/figma/<timestamp>/` with the naming scheme described above.

### Usage examples

```bash
# Capture nodes from a JSON file (supports multiple file keys)
bun run index.ts figma capture --ids-file ./examples/figma-nodes.json

# Capture nodes from a TXT file
bun run index.ts figma capture --ids-file ./examples/figma-node-ids.txt

# Capture at higher scale and different format
bun run index.ts figma capture --ids-file ./examples/figma-nodes.json --scale 4 --format jpg

# Capture to a custom path (single node only - create a file with one entry)
bun run index.ts figma capture --ids-file ./single-node.txt --output ./my-design.png
```

### Output structure example

After running `bun run index.ts figma capture --ids-file ./examples/figma-nodes.json`, files are organized as:

```
outputs/
└── figma/
    ├── .gitkeep
    └── 2025-11-12T02-01-00-895Z/
        ├── figma-design-fl5uK43wSluXQiL7vVHjFq-8802-46326.png
        └── figma-design-fl5uK43wSluXQiL7vVHjFq-7760-56939.png
```

Each execution creates a new timestamped folder, keeping captures organized by when they were taken. When capturing nodes from multiple files, each image will use its respective file key in the filename.
