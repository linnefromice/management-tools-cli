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

## Linear data sync

Use the `linear` subcommands to inspect or cache master data locally:

```bash
bun run index.ts linear projects --full
bun run index.ts linear teams --full
bun run index.ts linear sync
```

`linear sync` writes JSON snapshots for teams, projects, issues, users, labels, and cycles under `storage/linear/`, which is ignored by git.

This project was created using `bun init` in bun v1.3.1. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
