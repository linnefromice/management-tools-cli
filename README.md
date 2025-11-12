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

For the new Figma capture workflow also set:

```env
FIGMA_ACCESS_TOKEN=figd_xxx
FIGMA_FILE_KEY=fl5uK43wSluXQiL7vVHjFq
# Optional override (defaults to https://api.figma.com)
FIGMA_API_BASE_URL=https://api.figma.com
```

`FIGMA_ACCESS_TOKEN` must have the "File export" scope. `FIGMA_FILE_KEY` is the file ID segment in your Figma URL (`https://www.figma.com/design/<FILE_KEY>/...` or `https://www.figma.com/file/<FILE_KEY>/...`) and is used as a fallback when not specified in JSON configuration or URLs.

## Linear commands

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
bun run index.ts figma capture [node-id-or-url ...] \
  [--ids-file ./figma-nodes.json] \
  [--scale 2] \
  [--format png] \
  [--file <override-file-key>] \
  [--output ./custom/path.png]
```

````

- Provide zero or more positional node references (raw IDs like `8802:46326`, dash format `8802-46326`, or full URLs such as `https://www.figma.com/design/<FILE>/<Slug>?node-id=7760-56939&m=dev`). When only using `--ids-file`, omit the positional arguments entirely.
- Use `--ids-file` to pass a configuration file (`.json` or `.txt`):
  - **JSON format** (recommended): Specify individual `fileKey` and `nodeId` pairs, or full URLs. See `examples/figma-nodes.json`.
  - **TXT format** (legacy): One node ID or URL per line, `#` comments supported. See `examples/figma-node-ids.txt`.
- The command groups nodes by file key and batches them into `GET /v1/images/<FILE_KEY>?ids=<...>` requests, downloads each signed URL, and writes images under `outputs/figma/<timestamp>/`.
- Each execution creates a new timestamped folder (e.g., `outputs/figma/2025-11-12T02-01-00-895Z/`).
- Output filenames follow `figma-design-${file-key}-${node-id-with-hyphen}.${format}` (e.g., `figma-design-fl5uK43wSluXQiL7vVHjFq-7760-56939.png`).
- Add `--output` to override the path when capturing a single node.
- `--scale` accepts integers `1-4`; `--format` supports `png` or `jpg`.

### Logging

The Figma capture command includes detailed logging for API requests and file downloads. Set the `LOG_LEVEL` environment variable to control verbosity:

```bash
# Default: INFO level (shows API requests, downloads, and file writes)
bun run index.ts figma capture 8802-46326

# DEBUG level (includes additional details like headers, node IDs, buffer sizes)
LOG_LEVEL=debug bun run index.ts figma capture 8802-46326

# WARN level (only warnings and errors)
LOG_LEVEL=warn bun run index.ts figma capture 8802-46326
````

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
  },
  {
    "nodeId": "1234:5678"
  }
]
```

- Each entry can specify:
  - `fileKey` + `nodeId`: Explicit file and node IDs
  - `url`: Full Figma URL (file key and node ID extracted automatically)
  - `nodeId` only: Uses `FIGMA_FILE_KEY` from environment or `--file` flag as fallback
- Store this as `examples/figma-nodes.json` and use `--ids-file ./examples/figma-nodes.json`

#### TXT format (legacy)

The TXT format supports one node ID or URL per line:

```
# ios onboarding flows
8802:46326
https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Project?node-id=7760-56939
```

- Lines starting with `#` are ignored as comments
- Node IDs use the `FIGMA_FILE_KEY` from environment or `--file` flag
- URLs automatically extract the file key from the URL
- Store this as `examples/figma-node-ids.txt` and use `--ids-file ./examples/figma-node-ids.txt`

Both formats will save images under `outputs/figma/<timestamp>/` with the naming scheme described above.

### Usage examples

```bash
# Capture nodes from a JSON file (supports multiple file keys)
bun run index.ts figma capture --ids-file ./examples/figma-nodes.json

# Capture nodes from a TXT file (legacy format)
bun run index.ts figma capture --ids-file ./examples/figma-node-ids.txt

# Capture a single node with positional argument
bun run index.ts figma capture 8802:46326

# Capture from a full URL
bun run index.ts figma capture "https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/Project?node-id=7760-56939"

# Mix positional arguments and file input
bun run index.ts figma capture 8802:46326 --ids-file ./examples/figma-nodes.json

# Capture at higher scale and different format
bun run index.ts figma capture --ids-file ./examples/figma-nodes.json --scale 4 --format jpg

# Capture to a custom path (single node only)
bun run index.ts figma capture 8802:46326 --output ./my-design.png
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
