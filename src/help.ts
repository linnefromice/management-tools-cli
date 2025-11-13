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
  cli-name figma capture --ids-file <PATH> [--format png|jpg] [--scale 1-4] [--output <PATH>]`;

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
