# management-tools-cli

Linear / GitHub / Figma の日常ワークフローを 1 つの CLI にまとめたモノレポです。

- `packages/core`: 認証・HTTP・正規化ロジックをまとめた SDK。外部ツールから `@mng-tool/core` を import して再利用できます。
- `packages/cli`: core を利用した Bun 製 CLI。コマンド定義、出力整形、ローカルストレージを担当します。

## インストール

```bash
bun install
```

Bun のワークスペースとして構成しているため、これだけで全パッケージの依存が入ります。

## CLI の実行

既存と同じくリポジトリ直下のエントリーポイントを叩くだけです。

```bash
bun run index.ts --help
bun run index.ts linear projects --remote
```

パッケージ単位でスクリプトを走らせたい場合は `--filter management-tools-cli` を付けます。

```bash
bun run --filter management-tools-cli test
bun run --filter management-tools-cli typecheck
bun run --filter management-tools-cli build:binary
```

`build:binary` は Bun ランタイム込みのスタンドアロン実行ファイル (`dist/mng-tool`) を生成します。CI の `release-binary` ワークフローは `v*` タグに反応して Linux 向けバイナリ (`dist/mng-tool-linux`) をリリースに添付します。

## ディレクトリ構成

```
packages/
  core/   # Linear/GitHub/Figma/Storage/Time などのサービス群
  cli/    # CLI の本体。core を組み合わせてコマンドを実装
storage/  # Linear のローカルキャッシュ (実行時に生成)
tests/    # Bun test で共有するテストスイート
dist/     # ビルド成果物 (bundle と standalone binary)
```

`@mng-tool/core` を直接使う場合のサンプル:

```ts
import { createLinearService } from "@mng-tool/core";

const linear = createLinearService({
  apiKey: process.env.LINEAR_API_KEY!,
  workspaceId: process.env.LINEAR_WORKSPACE_ID,
});

const projects = await linear.fetchWorkspaceProjects();
```

## クイックスタート

```bash
# linear
bun run index.ts linear sync
bun run index.ts linear search-issues --project <PROJECT_ID>

# figma
bun run index.ts figma capture --ids-file ./configs/figma.txt --format png

# github review-status
bun run index.ts github review-status --ready-only

# github commits
bun run index.ts github commits --user linnefromice --days 5 --timezone Asia/Tokyo
```

## 必要な環境変数

`.env.example` をコピーして以下を設定します (Bun が自動で読み込みます)。

```env
LINEAR_API_KEY=lin_api_xxx
LINEAR_WORKSPACE_ID=<workspace-uuid>
FIGMA_ACCESS_TOKEN=figd_xxx
FIGMA_API_BASE_URL=https://api.figma.com
GITHUB_TOKEN=ghp_xxx
GITHUB_OWNER=your-org
GITHUB_REPO=your-repo
# もしくは GITHUB_REPOSITORY=your-org/your-repo
```

- Linear: `linear projects / sync / search-issues` などのコマンドで使用するため、Workspace ID も指定してください。
- Figma: `figma capture` 用。TXT/JSON で指定した `fileKey#nodeId` をまとめて画像化します。
- GitHub: `github prs / review-status / commits` 用。`read:org` や `repo` スコープを持つ token が必要です。

## 主なコマンド

### Linear

| コマンド | 説明 | 代表的なフラグ |
| --- | --- | --- |
| `bun run index.ts linear projects` | プロジェクト一覧 (デフォルトはローカルキャッシュ) | `--remote`, `--full`, `--format csv`, `--output`, `--all-fields` |
| `bun run index.ts linear issue CORE-123` | ローカルストレージから単一課題を取得 | `--format csv`, `--output`, `--all-fields` |
| `bun run index.ts linear search-issues` | キャッシュ済み課題をフィルタ検索 | `--project`, `--label`, `--cycle`, `--format`, `--output` |
| `bun run index.ts linear sync` | Linear の master data を `storage/linear/*.json` に同期 | `--format`, `--output` |

### GitHub

| コマンド | 説明 | 代表的なフラグ |
| --- | --- | --- |
| `bun run index.ts github prs` | PR 一覧 (レビュアー状況を含む) | `--state`, `--limit`, `--created-after`, `--updated-after`, `--format`, `--output` |
| `bun run index.ts github review-status` | 直近 7 日以内に更新された PR のレビューステータス | `--limit`, `--ready-only`, `--format`, `--output` |
| `bun run index.ts github commits --user <login>` | 指定ユーザーのコミット履歴 | `--days`, `--limit`, `--owner`, `--repo`, `--exclude-merges`, `--timezone`, `--window-boundary`, `--format`, `--output` |

### Figma

```bash
bun run index.ts figma capture --ids-file ./configs/figma.txt --format png --scale 2
```

- `--ids-file` には `.txt` (1行1 node) または `.json` (複数 node) を指定
- 1 node のみを保存する場合は `--output ./outputs/figma/latest.png` でパスを固定可能

## バイナリビルド / リリース

```bash
bun run --filter management-tools-cli check-and-build
```

- Lint / Format / Typecheck / Test を順番に実行
- `dist/mng-tool` (macOS) を生成し、`.env` を同ディレクトリにコピー
- GitHub では `v*` タグの push で Linux バイナリを含むリリースが作成されます

---

English README is available in [`README.md`](./README.md).
