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
  cli-name figma capture <node-id-or-url> [--format png|jpg] [--scale 1-4] [--output <PATH>]`;

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
  cli-name figma capture <node-id-or-url> [options]

Options:
  --format <png|jpg>   Image format (default: png)
  --scale <1-4>        Scale factor for rendering (default: 2)
  --output <path>      Custom output file path

Examples:
  # Capture using full Figma URL
  cli-name figma capture "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456"

  # Capture using node ID only
  cli-name figma capture "123:456"

  # Custom format and scale
  cli-name figma capture "123:456" --format jpg --scale 4

  # Custom output path
  cli-name figma capture "123:456" --output ./designs/my-capture.png

Setup:
  1. Install @figma/mcp-server: npm install -g @figma/mcp-server
  2. Start the MCP server with your Figma access token:
     FIGMA_ACCESS_TOKEN=<your-token> FIGMA_FILE_KEY=<your-file-key> figma-mcp-server
  3. (Optional) Set FIGMA_MCP_ENDPOINT in .env if using a custom endpoint
     - FIGMA_MCP_ENDPOINT (default: http://localhost:4001)`;
