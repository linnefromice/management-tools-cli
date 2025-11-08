# management-tools-cli

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Environment variables

Bun automatically loads variables from a local `.env` file. Copy `.env.example` to `.env` and set:

```env
LINEAR_API_KEY=lin_api_xxx
LINEAR_WORKSPACE_ID=<workspace-uuid>
```

These are required for `linear-projects` to authenticate against the correct workspace via the Linear SDK.

## Linear commands

After configuring env vars you can inspect Linear data via subcommands:

| Command | Description | Useful flags |
| --- | --- | --- |
| `bun run index.ts linear projects` | List projects from local cache by default | `--full` (raw payload), `--format csv`, `--remote` (refresh cache via API) |
| `bun run index.ts linear teams` | List teams | `--full`, `--format csv`, `--remote` |
| `bun run index.ts linear issue <KEY>` | Retrieve a single issue (from local storage) by key such as `CORE-123` | `--format csv` (treats the single issue as a dataset) |
| `bun run index.ts linear issues` | List issues from cache | `--format csv`, `--remote` |
| `bun run index.ts linear users` | List members | `--format csv`, `--remote` |
| `bun run index.ts linear labels` | List issue labels | `--format csv`, `--remote` |
| `bun run index.ts linear cycles` | List cycles | `--format csv`, `--remote` |
| `bun run index.ts linear issues-local` | Query issues already synced to disk | `--project <id>`, `--label <id>`, `--cycle <id>`, `--format csv` |
| `bun run index.ts linear sync` | Download teams, projects, issues, users, labels, cycles and store them under `storage/linear/` for offline analysis | — |

> ヒント: `--remote` を付けると対象データを Linear API から再取得し、ローカルの `storage/linear/*.json` も自動更新します。指定しない場合は最新のローカルキャッシュを読み込みます。

### Output formats

All list-style commands default to pretty JSON. Add `--format csv` to emit a CSV table (helpful when piping to spreadsheets or passing a compact prompt into an LLM). CSV conversion requires the command to know which collection to print; that is handled automatically when `--format csv` is supported.

### Local storage workflow

1. Run `bun run index.ts linear sync` to refresh cached JSON files (`storage/linear/*.json`).
2. Use `linear issue <KEY>` or `linear issues-local` with filters to query the cached data without hitting the API.
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
