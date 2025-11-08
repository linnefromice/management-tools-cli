export const getUsageText = () => `Usage:
  bun run index.ts help
  bun run index.ts greet --hour <HH> --name <YourName>
  bun run index.ts linear projects [--full] [--format csv] [--remote]
  bun run index.ts linear teams [--full] [--format csv] [--remote]
  bun run index.ts linear issue <KEY> [--format csv]
  bun run index.ts linear issues [--format csv] [--remote]
  bun run index.ts linear users [--format csv] [--remote]
  bun run index.ts linear labels [--format csv] [--remote]
  bun run index.ts linear cycles [--format csv] [--remote]
  bun run index.ts linear search-issues [--project <ID>] [--label <ID>] [--cycle <ID>] [--format csv]
  bun run index.ts linear sync [data-types]
    - Sync all data or specific data types (comma-separated)
    - Valid data types: teams, projects, issues, users, labels, cycles
    - Example: bun run index.ts linear sync issues,users`;

export const getLinearUsageText = () => `Linear commands:
  bun run index.ts linear projects [--full] [--format csv] [--remote]
  bun run index.ts linear teams [--full] [--format csv] [--remote]
  bun run index.ts linear issue <KEY> [--format csv]
  bun run index.ts linear issues [--format csv] [--remote]
  bun run index.ts linear users [--format csv] [--remote]
  bun run index.ts linear labels [--format csv] [--remote]
  bun run index.ts linear cycles [--format csv] [--remote]
  bun run index.ts linear search-issues [--project <ID>] [--label <ID>] [--cycle <ID>] [--format csv]
  bun run index.ts linear sync [data-types]
    - Sync all data or specific data types (comma-separated)
    - Valid data types: teams, projects, issues, users, labels, cycles
    - Example: bun run index.ts linear sync issues,users`;
