export const getUsageText = () => `Usage:
  cli-name help
  cli-name greet --hour <HH> --name <YourName>
  cli-name linear projects [--full] [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear teams [--full] [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear issue <KEY> [--format csv] [--output <PATH>] [--all-fields]
  cli-name linear issues [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear users [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear labels [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear cycles [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear search-issues [--project <ID>] [--label <ID>] [--cycle <ID>] [--format csv] [--output <PATH>] [--all-fields]
  cli-name linear sync
  cli-name figma capture --ids-file <PATH> [--format png|jpg] [--scale 1-4] [--output <PATH>]
  cli-name github prs [--state open|closed|all] [--limit <N>] [--format csv] [--output <PATH>] [--all-fields] [--created-after <ISO>] [--created-before <ISO>] [--updated-after <ISO>] [--updated-before <ISO>]
  cli-name github review-status [--limit <N>] [--ready-only] [--format csv] [--output <PATH>] [--all-fields]
  cli-name github commits --user <LOGIN> [--days <N>] [--window-boundary <YYYYMMDD[HHMM]>] [--timezone <IANA|±HHMM>] [--limit <N>] [--owner <OWNER> --repo <NAME>] [--exclude-merges] [--format csv] [--output <PATH>] [--all-fields]`;

export const getLinearUsageText = () => `Linear commands:
  cli-name linear projects [--full] [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear teams [--full] [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear issue <KEY> [--format csv] [--output <PATH>] [--all-fields]
  cli-name linear issues [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear users [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear labels [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear cycles [--format csv] [--remote] [--output <PATH>] [--all-fields]
  cli-name linear search-issues [--project <ID>] [--label <ID>] [--cycle <ID>] [--format csv] [--output <PATH>] [--all-fields]
  cli-name linear sync`;

export const getFigmaUsageText = () => `Figma commands:
  cli-name figma capture --ids-file <path> [options]

Options:
  --ids-file <path>    REQUIRED. Text (.txt) or JSON (.json) file specifying nodes to capture
  --format <png|jpg>   Image format (default: png)
  --scale <1-4>        Scale factor for rendering (default: 2)
  --output <path>      Custom output path (single-node only)
                       Default: outputs/figma/<timestamp>/figma-design-<file>-<node>.png

File Formats:

  .txt format - Each line must be either:
    - FILE_KEY#NODE_ID (e.g., fl5uK43wSluXQiL7vVHjFq#8802:46326)
    - Full Figma URL (e.g., https://www.figma.com/design/FILE_KEY/...?node-id=123-456)
    - Lines starting with # are treated as comments

  .json format - Array of objects with either:
    - { "fileKey": "...", "nodeId": "..." }
    - { "url": "https://www.figma.com/..." }

Examples:
  # Capture nodes from a .txt file
  cli-name figma capture --ids-file ./figma-node-ids.txt

  # Capture nodes from a .json file with custom format and scale
  cli-name figma capture --ids-file ./figma-nodes.json --format jpg --scale 4

  # Example .txt file content:
  # fl5uK43wSluXQiL7vVHjFq#8802:46326
  # https://www.figma.com/design/fl5uK43wSluXQiL7vVHjFq/UI-Design?node-id=7760-56939

  # Example .json file content:
  # [
  #   { "fileKey": "fl5uK43wSluXQiL7vVHjFq", "nodeId": "8802:46326" },
  #   { "url": "https://www.figma.com/design/..." }
  # ]

Setup:
  1. Create a Figma Personal Access Token with file export scope.
  2. Set FIGMA_ACCESS_TOKEN in your environment or .env file.
  3. Run the CLI command; images will be saved under outputs/figma by default.`;

export const getGithubUsageText = () => `GitHub commands:
  cli-name github prs [options]
  cli-name github review-status [options]
  cli-name github commits [options]

github prs options:
  --state <open|closed|all>   Filter by PR state (default: open)
  --limit <N>                 Maximum number of PRs to return (default: 20, max: 200)
  --created-after <ISO>       Only include PRs created after (inclusive) the timestamp
  --created-before <ISO>      Only include PRs created before (inclusive) the timestamp
  --updated-after <ISO>       Only include PRs updated after (inclusive) the timestamp
  --updated-before <ISO>      Only include PRs updated before (inclusive) the timestamp
  --format <json|csv>         Output format (default: json)
  --output <path>             Optional file destination; defaults to storage/exports/github-prs-<timestamp>.json
  --all-fields                Skip analytics-friendly field filtering

github review-status options:
  Lists open PRs updated within the last 7 days and highlights reviewer state.
  --limit <N>                 Maximum number of PRs (default: 50, max: 200)
  --ready-only                Skip pull requests marked as draft or whose title includes "WIP".
  --format <json|csv>         Output format (default: json)
  --output <path>             Optional file destination; defaults to storage/exports/github-review-status-<timestamp>.<ext>
  --all-fields                Skip analytics-friendly field filtering

github commits options:
  Fetch commits authored by a specific user within the most recent N days (default 7).
  --user <login>              REQUIRED. GitHub login to filter commits.
  --days <N>                  Lookback window in days (default: 7).
  --window-boundary <YYYYMMDD[HHMM]>
                              Set the exclusive end of the window using a YYYYMMDD or YYYYMMDDHHMM timestamp (local to the timezone option).
  --timezone <IANA|±HHMM>     Timezone for interpreting --window-boundary (default: your system timezone). Accepts IANA names (Asia/Tokyo) or numeric offsets (+0900).
  --owner <owner> --repo <repo>
                              Override the repository resolved from environment variables. Both flags are required when overriding.
  --limit <N>                 Maximum number of commits (default: 40, max: 200)
  --exclude-merges            Skip merge commits (parent count > 1) when listing results.
  --format <json|csv>         Output format (default: json)
  --output <path>             Optional file destination; defaults to storage/exports/github-commits-<timestamp>.<ext>
  --all-fields                Skip analytics-friendly field filtering

Environment:
  Set GITHUB_TOKEN plus either (GITHUB_OWNER + GITHUB_REPO) or a combined GITHUB_REPOSITORY (owner/repo).`;
