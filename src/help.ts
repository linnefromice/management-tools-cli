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
  cli-name figma capture [node-id-or-url ...] [--ids-file <PATH>] [--format png|jpg] [--scale 1-4] [--output <PATH>] [--file <KEY>]`;

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
  cli-name figma capture [node-id-or-url ...] [options]

Options:
  --ids-file <path>    Text file listing node IDs/URLs (one per line); omit positional args when using this
  --file <key>         Override FIGMA_FILE_KEY for this run
  --format <png|jpg>   Image format (default: png)
  --scale <1-4>        Scale factor for rendering (default: 2)
  --output <path>      Custom output path (single-node only; default outputs/figma/<timestamp>_<file>-<node>.png)

Examples:
  # Capture a single node via URL
  cli-name figma capture "https://www.figma.com/design/<FILE>/<Slug>?node-id=123%3A456"

  # Capture a single node via node ID
  cli-name figma capture "123:456"

  # Capture multiple nodes defined in a text file (no positional arguments needed)
  cli-name figma capture --ids-file ./figma-node-ids.txt

  # Custom format and scale
  cli-name figma capture "123:456" --format jpg --scale 4

Setup:
  1. Create a Figma Personal Access Token with file export scope.
  2. Set FIGMA_ACCESS_TOKEN and FIGMA_FILE_KEY in your environment or .env file.
  3. Run the CLI command; images will be saved under outputs/figma by default.`;
