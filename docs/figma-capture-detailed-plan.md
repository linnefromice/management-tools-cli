# Figma Capture Command - Detailed Implementation Plan

## 概要

Figma の MCP Server (`@figma/mcp-server`) を利用して、指定した Figma ノードのキャプチャ画像を取得する CLI コマンドを実装する。

```bash
# 基本的な使用例
cli-name figma capture "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456"
cli-name figma capture "123:456"  # node-id のみでも可

# オプション付き
cli-name figma capture "123:456" --format png --scale 2 --output ./captures/my-design.png
```

---

## 1. 型定義とインターフェース設計

### 1.1 新規ファイル: `src/figma/types.ts`

```typescript
// MCP JSON-RPC リクエスト型
export type McpRequest = {
  jsonrpc: "2.0";
  id: number;
  method: "tools/call";
  params: {
    tool: "get_image";
    arguments: {
      node_ids: string[];
      format?: "png" | "jpg";
      scale?: number;
    };
  };
};

// MCP JSON-RPC レスポンス型
export type McpResponse = {
  jsonrpc: "2.0";
  id: number;
  result?: {
    format: string;
    node_id: string;
    image: string; // data:image/png;base64,iVBOR...
  };
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
};

// Figma キャプチャ入力型
export type FigmaCaptureInput = {
  nodeIdOrUrl: string;
  format?: "png" | "jpg";
  scale?: 1 | 2 | 3 | 4;
  outputPath?: string;
};

// Figma キャプチャ結果型
export type FigmaCaptureResult = {
  nodeId: string;
  format: "png" | "jpg";
  savedPath: string;
  source: "mcp-server";
  timestamp: string;
  base64Length: number;
};

// Figma エラー型
export class FigmaMcpError extends Error {
  constructor(
    public code: number,
    message: string,
    public data?: unknown,
  ) {
    super(`Figma MCP Error [${code}]: ${message}`);
    this.name = "FigmaMcpError";
  }
}
```

---

## 2. URL パーサーモジュール

### 2.1 新規ファイル: `src/figma/url-parser.ts`

```typescript
/**
 * Figma URL または生のノード ID を正規化
 *
 * 入力例:
 * - "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456"
 * - "123:456"
 * - "123%3A456"
 *
 * 出力: "123:456"
 */
export const parseNodeId = (input: string): string => {
  // 既にノードID形式の場合（"123:456" または "123%3A456"）
  if (!input.startsWith("http")) {
    // URL エンコードされている可能性があるのでデコード
    const decoded = decodeURIComponent(input);
    // 基本的なノードID検証（数字:数字の形式）
    if (/^\d+:\d+$/.test(decoded)) {
      return decoded;
    }
    throw new Error(
      `Invalid node ID format: "${input}". Expected format: "123:456"`,
    );
  }

  // URL の場合
  try {
    const url = new URL(input);
    const nodeIdParam = url.searchParams.get("node-id");

    if (!nodeIdParam) {
      throw new Error(
        `No node-id parameter found in URL: ${input}`,
      );
    }

    // URL エンコードされている可能性があるのでデコード
    const decoded = decodeURIComponent(nodeIdParam);

    // 基本的な検証
    if (!/^\d+:\d+$/.test(decoded)) {
      throw new Error(
        `Invalid node-id format in URL: "${decoded}". Expected format: "123:456"`,
      );
    }

    return decoded;
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to parse Figma URL: ${error.message}`);
    }
    throw error;
  }
};

/**
 * ノードIDの検証
 */
export const validateNodeId = (nodeId: string): boolean => {
  return /^\d+:\d+$/.test(nodeId);
};
```

### 2.2 テスト: `tests/figma-url-parser.test.ts`

```typescript
import { test, expect, describe } from "bun:test";
import { parseNodeId, validateNodeId } from "../src/figma/url-parser";

describe("parseNodeId", () => {
  test("parses node ID from full Figma URL", () => {
    const url = "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456";
    expect(parseNodeId(url)).toBe("123:456");
  });

  test("handles already decoded node ID", () => {
    expect(parseNodeId("123:456")).toBe("123:456");
  });

  test("handles URL-encoded node ID", () => {
    expect(parseNodeId("123%3A456")).toBe("123:456");
  });

  test("throws on invalid node ID format", () => {
    expect(() => parseNodeId("invalid")).toThrow(/Invalid node ID format/);
  });

  test("throws on URL without node-id parameter", () => {
    const url = "https://www.figma.com/file/xxxxx/YourProject";
    expect(() => parseNodeId(url)).toThrow(/No node-id parameter found/);
  });
});

describe("validateNodeId", () => {
  test("validates correct node ID", () => {
    expect(validateNodeId("123:456")).toBe(true);
  });

  test("rejects invalid format", () => {
    expect(validateNodeId("123-456")).toBe(false);
    expect(validateNodeId("invalid")).toBe(false);
  });
});
```

---

## 3. MCP クライアントモジュール

### 3.1 新規ファイル: `src/figma/mcp-client.ts`

```typescript
import type { McpRequest, McpResponse, FigmaMcpError } from "./types";
import { FigmaMcpError as FigmaError } from "./types";

/**
 * MCP Server へ JSON-RPC リクエストを送信
 */
export const callMcpGetImage = async (
  endpoint: string,
  nodeIds: string[],
  options?: {
    format?: "png" | "jpg";
    scale?: number;
  },
): Promise<{ nodeId: string; format: string; base64Image: string }> => {
  const request: McpRequest = {
    jsonrpc: "2.0",
    id: 1,
    method: "tools/call",
    params: {
      tool: "get_image",
      arguments: {
        node_ids: nodeIds,
        format: options?.format ?? "png",
        scale: options?.scale ?? 2,
      },
    },
  };

  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(request),
    });
  } catch (error) {
    throw new Error(
      `Failed to connect to Figma MCP Server at ${endpoint}. ` +
      `Ensure @figma/mcp-server is running. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  if (!response.ok) {
    throw new Error(
      `MCP Server returned HTTP ${response.status}: ${response.statusText}`,
    );
  }

  let data: McpResponse;
  try {
    data = await response.json() as McpResponse;
  } catch (error) {
    throw new Error(
      `Failed to parse MCP Server response as JSON. ` +
      `Error: ${error instanceof Error ? error.message : String(error)}`,
    );
  }

  // MCP エラーレスポンスの処理
  if (data.error) {
    throw new FigmaError(
      data.error.code,
      data.error.message,
      data.error.data,
    );
  }

  // 結果の検証
  if (!data.result || !data.result.image) {
    throw new Error(
      `MCP Server returned invalid response: missing result or image data`,
    );
  }

  return {
    nodeId: data.result.node_id,
    format: data.result.format,
    base64Image: data.result.image,
  };
};

/**
 * Base64 画像データから実際の画像バイナリを抽出
 *
 * 入力: "data:image/png;base64,iVBORw0KGgoAAAA..."
 * 出力: バイナリバッファ
 */
export const decodeBase64Image = (dataUrl: string): Buffer => {
  const match = /^data:image\/\w+;base64,(.+)$/.exec(dataUrl);

  if (!match || !match[1]) {
    throw new Error(
      `Invalid base64 image data URL format. Expected "data:image/*;base64,..."`,
    );
  }

  const base64Data = match[1];
  return Buffer.from(base64Data, "base64");
};
```

### 3.2 テスト: `tests/figma-mcp-client.test.ts`

```typescript
import { test, expect, describe } from "bun:test";
import { decodeBase64Image } from "../src/figma/mcp-client";

describe("decodeBase64Image", () => {
  test("decodes valid base64 image data URL", () => {
    const dataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+P+/HgAFhAJ/wlseKgAAAABJRU5ErkJggg==";
    const buffer = decodeBase64Image(dataUrl);
    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  test("throws on invalid format", () => {
    expect(() => decodeBase64Image("not-a-data-url")).toThrow(/Invalid base64 image data URL format/);
  });

  test("throws on missing base64 data", () => {
    expect(() => decodeBase64Image("data:image/png;base64,")).toThrow(/Invalid base64 image data URL format/);
  });
});

// Note: callMcpGetImage の統合テストは実際の MCP Server が必要なため、
// モック版または E2E テストとして別途実装を推奨
```

---

## 4. メイン Figma モジュール

### 4.1 新規ファイル: `src/figma.ts`

```typescript
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseNodeId } from "./figma/url-parser";
import { callMcpGetImage, decodeBase64Image } from "./figma/mcp-client";
import type { FigmaCaptureInput, FigmaCaptureResult } from "./figma/types";
import {
  FIGMA_ACCESS_TOKEN,
  FIGMA_FILE_KEY,
  FIGMA_MCP_ENDPOINT,
} from "./constants";

/**
 * デフォルト出力パスの生成
 */
const buildDefaultFigmaOutputPath = (nodeId: string, format: string): string => {
  const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
  const sanitizedNodeId = nodeId.replace(/:/g, "-");
  const dir = path.resolve(process.cwd(), "storage", "figma");
  return path.join(dir, `${sanitizedNodeId}-${timestamp}.${format}`);
};

/**
 * Figma キャプチャのメイン処理
 */
export const captureFigmaNode = async (
  input: FigmaCaptureInput,
): Promise<FigmaCaptureResult> => {
  // 1. ノードIDの正規化
  const nodeId = parseNodeId(input.nodeIdOrUrl);
  const format = input.format ?? "png";
  const scale = input.scale ?? 2;

  // 2. MCP Server へリクエスト
  const mcpResult = await callMcpGetImage(
    FIGMA_MCP_ENDPOINT,
    [nodeId],
    { format, scale },
  );

  // 3. Base64 画像データのデコード
  const imageBuffer = decodeBase64Image(mcpResult.base64Image);

  // 4. ファイル保存
  const outputPath = input.outputPath
    ? path.resolve(process.cwd(), input.outputPath)
    : buildDefaultFigmaOutputPath(nodeId, format);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, imageBuffer);

  // 5. 結果の返却
  return {
    nodeId: mcpResult.nodeId,
    format: format,
    savedPath: outputPath,
    source: "mcp-server",
    timestamp: new Date().toISOString(),
    base64Length: mcpResult.base64Image.length,
  };
};

/**
 * 設定の検証（起動時チェック用）
 */
export const validateFigmaConfig = (): {
  valid: boolean;
  errors: string[];
} => {
  const errors: string[] = [];

  if (!FIGMA_ACCESS_TOKEN || FIGMA_ACCESS_TOKEN === "your-token-here") {
    errors.push(
      "FIGMA_ACCESS_TOKEN is not configured. Set environment variable FIGMA_ACCESS_TOKEN.",
    );
  }

  if (!FIGMA_FILE_KEY || FIGMA_FILE_KEY === "your-file-key-here") {
    errors.push(
      "FIGMA_FILE_KEY is not configured. Set environment variable FIGMA_FILE_KEY.",
    );
  }

  if (!FIGMA_MCP_ENDPOINT) {
    errors.push("FIGMA_MCP_ENDPOINT is not configured.");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};
```

---

## 5. 設定定数の追加

### 5.1 更新ファイル: `src/constants.ts`

既存の定数定義の末尾に追加：

```typescript
// ... 既存の ANALYTICS_* 定数 ...

// Figma MCP Server 設定
export const FIGMA_ACCESS_TOKEN =
  process.env.FIGMA_ACCESS_TOKEN ?? "your-token-here";

export const FIGMA_FILE_KEY =
  process.env.FIGMA_FILE_KEY ?? "your-file-key-here";

export const FIGMA_MCP_ENDPOINT =
  process.env.FIGMA_MCP_ENDPOINT ?? "http://localhost:4001";
```

### 5.2 環境変数の設定

`.env` ファイルに以下を追加（例）：

```bash
# Figma Configuration
FIGMA_ACCESS_TOKEN=figd_...your-actual-token...
FIGMA_FILE_KEY=xxxxxxxxxxxxxxxxxxxxx
FIGMA_MCP_ENDPOINT=http://localhost:4001
```

---

## 6. CLI コマンドの実装

### 6.1 更新ファイル: `index.ts`

既存の `index.ts` に以下を追加：

```typescript
// ===== インポートセクション（既存の import に追加） =====
import {
  captureFigmaNode,
  validateFigmaConfig,
} from "./src/figma";
import type { FigmaCaptureInput } from "./src/figma/types";

// ===== Figma コマンドハンドラー（新規追加） =====

/**
 * figma capture コマンドの実行
 */
const runFigmaCapture = async (args: string[]) => {
  // 設定の検証
  const configCheck = validateFigmaConfig();
  if (!configCheck.valid) {
    console.error("Figma configuration is incomplete:");
    configCheck.errors.forEach((err) => console.error(`  - ${err}`));
    console.error("\nRefer to README.md for setup instructions.");
    process.exit(1);
  }

  // 位置引数の取得（ノードID or URL）
  const positional = getPositionalArgs(args);
  const nodeIdOrUrl = positional[0];

  if (!nodeIdOrUrl) {
    console.error("Usage: cli-name figma capture <node-id-or-url> [options]");
    console.error("\nOptions:");
    console.error("  --format <png|jpg>   Image format (default: png)");
    console.error("  --scale <1-4>        Scale factor (default: 2)");
    console.error("  --output <path>      Output file path (default: storage/figma/<node-id>-<timestamp>.<format>)");
    process.exit(1);
  }

  // オプションの解析
  const formatValue = getFlagValue(args, "format");
  const format =
    formatValue === "jpg" ? "jpg" :
    formatValue === "png" ? "png" :
    undefined;

  const scaleValue = getFlagValue(args, "scale");
  const scale = scaleValue ? Number(scaleValue) : undefined;
  if (scale !== undefined && (scale < 1 || scale > 4 || Number.isNaN(scale))) {
    console.error("Error: --scale must be a number between 1 and 4");
    process.exit(1);
  }

  const outputPath = getFlagValue(args, "output");

  // 入力オブジェクトの構築
  const input: FigmaCaptureInput = {
    nodeIdOrUrl,
    format,
    scale: scale as 1 | 2 | 3 | 4 | undefined,
    outputPath,
  };

  try {
    console.log(`Capturing Figma node: ${nodeIdOrUrl}...`);
    const result = await captureFigmaNode(input);

    console.log("\n✓ Capture completed successfully");
    console.log(`  Node ID:    ${result.nodeId}`);
    console.log(`  Format:     ${result.format}`);
    console.log(`  Saved to:   ${result.savedPath}`);
    console.log(`  Timestamp:  ${result.timestamp}`);
  } catch (error) {
    console.error("\n✗ Failed to capture Figma node");
    if (error instanceof Error) {
      console.error(`  Error: ${error.message}`);
    }
    process.exit(1);
  }
};

/**
 * figma コマンドのルーター
 */
const runFigma = async (args: string[]) => {
  const [subCommand, ...figmaArgs] = args;

  if (!subCommand || subCommand === "help") {
    console.log("Usage: cli-name figma <subcommand> [options]");
    console.log("\nSubcommands:");
    console.log("  capture <node-id-or-url>  Capture a Figma node as an image");
    console.log("  help                      Show this help message");
    console.log("\nRun 'cli-name figma <subcommand> --help' for more information.");
    if (!subCommand) process.exit(1);
    return;
  }

  switch (subCommand) {
    case "capture":
      await runFigmaCapture(figmaArgs);
      break;
    default:
      console.error(`Unknown figma subcommand: ${subCommand}`);
      process.exit(1);
  }
};

// ===== メインコマンドスイッチに追加 =====
switch (command) {
  case "greet":
    runGreet();
    break;
  case "help":
    printHelp();
    break;
  case "linear":
    void runLinear(rawArgs);
    break;
  // ===== 新規追加 =====
  case "figma":
    void runFigma(rawArgs);
    break;
  // ===================
  default:
    exitWithUsage(`Unknown command: ${command}`);
}
```

---

## 7. ヘルプテキストの更新

### 7.1 更新ファイル: `src/help.ts`

既存のヘルプテキストに Figma コマンドを追加：

```typescript
export const getUsageText = () => `
Usage: cli-name <command> [options]

Commands:
  greet [name]           Greet the user
  linear <subcommand>    Linear workspace operations
  figma <subcommand>     Figma design capture operations
  help                   Show this help message

Run 'cli-name <command> help' for more information on a specific command.
`;

export const getFigmaUsageText = () => `
Usage: cli-name figma <subcommand> [options]

Subcommands:
  capture <node-id-or-url>  Capture a Figma node as an image

Options for 'capture':
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
  2. Start the MCP server: FIGMA_ACCESS_TOKEN=<your-token> figma-mcp-server
  3. Set environment variables in .env:
     - FIGMA_ACCESS_TOKEN (required)
     - FIGMA_FILE_KEY (required)
     - FIGMA_MCP_ENDPOINT (default: http://localhost:4001)
`;
```

そして `index.ts` に Figma ヘルプを追加：

```typescript
import { getUsageText, getLinearUsageText, getFigmaUsageText } from "./src/help";

const printFigmaHelp = () => {
  console.log(getFigmaUsageText());
};

// runFigma 関数内で help 時に呼び出し
```

---

## 8. テストの実装

### 8.1 統合テスト: `tests/figma-integration.test.ts`

```typescript
import { test, expect, describe, beforeAll } from "bun:test";
import { captureFigmaNode } from "../src/figma";
import { readFile, unlink } from "node:fs/promises";
import path from "node:path";

// Note: このテストは実際の Figma MCP Server が起動している必要がある
// CI 環境では skip するか、モックサーバーを用意する

describe.skip("Figma Integration Tests (requires running MCP server)", () => {
  const testNodeId = "123:456"; // 実際のテスト用ノードIDに置き換え

  test("captures Figma node and saves to file", async () => {
    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      format: "png",
      scale: 1,
    });

    expect(result.nodeId).toBe(testNodeId);
    expect(result.format).toBe("png");
    expect(result.savedPath).toMatch(/\.png$/);

    // ファイルが実際に存在し、サイズが0より大きいことを確認
    const fileBuffer = await readFile(result.savedPath);
    expect(fileBuffer.length).toBeGreaterThan(0);

    // テスト後のクリーンアップ
    await unlink(result.savedPath);
  });

  test("handles custom output path", async () => {
    const customPath = path.resolve(process.cwd(), "test-capture.png");

    const result = await captureFigmaNode({
      nodeIdOrUrl: testNodeId,
      outputPath: customPath,
    });

    expect(result.savedPath).toBe(customPath);

    // クリーンアップ
    await unlink(customPath);
  });
});
```

---

## 9. ドキュメント更新

### 9.1 README.md に追加するセクション

```markdown
## Figma Capture

### Prerequisites

1. Install the Figma MCP Server:
   ```bash
   npm install -g @figma/mcp-server
   ```

2. Get a Figma Personal Access Token:
   - Visit https://www.figma.com/developers
   - Generate a new personal access token

3. Configure environment variables in `.env`:
   ```bash
   FIGMA_ACCESS_TOKEN=figd_...your-token...
   FIGMA_FILE_KEY=your-figma-file-key
   FIGMA_MCP_ENDPOINT=http://localhost:4001  # optional, defaults to this
   ```

### Usage

1. Start the MCP Server:
   ```bash
   FIGMA_ACCESS_TOKEN=figd_...your-token... figma-mcp-server
   ```

2. Capture a Figma node:
   ```bash
   # Using full URL
   cli-name figma capture "https://www.figma.com/file/xxxxx/YourProject?node-id=123%3A456"

   # Using node ID directly
   cli-name figma capture "123:456"

   # With custom options
   cli-name figma capture "123:456" --format jpg --scale 4 --output ./my-design.jpg
   ```

### Options

- `--format <png|jpg>`: Output image format (default: png)
- `--scale <1-4>`: Render scale factor (default: 2)
- `--output <path>`: Custom output file path (default: `storage/figma/<node-id>-<timestamp>.<format>`)

### Output

By default, captured images are saved to:
```
storage/figma/<node-id>-<timestamp>.<format>
```

Example:
```
storage/figma/123-456-2025-01-15T10-30-00-000Z.png
```
```

---

## 10. 実装チェックリスト

### Phase 1: 基盤整備
- [ ] `src/figma/types.ts` の型定義作成
- [ ] `src/figma/url-parser.ts` の実装
- [ ] `tests/figma-url-parser.test.ts` の実装とテスト実行
- [ ] `src/constants.ts` に Figma 設定を追加

### Phase 2: コア機能
- [ ] `src/figma/mcp-client.ts` の実装
- [ ] `tests/figma-mcp-client.test.ts` の実装
- [ ] `src/figma.ts` のメイン処理実装
- [ ] エラーハンドリングの実装

### Phase 3: CLI 統合
- [ ] `index.ts` に `runFigma` と `runFigmaCapture` を追加
- [ ] `src/help.ts` にヘルプテキストを追加
- [ ] コマンドラインオプションのパース実装

### Phase 4: テストとドキュメント
- [ ] `tests/figma-integration.test.ts` の実装
- [ ] README.md の更新
- [ ] `.env.example` の作成
- [ ] 手動テストの実施

### Phase 5: 品質向上
- [ ] エラーメッセージの改善
- [ ] ロギングの追加（`src/logger.ts` 利用）
- [ ] リトライ機構の検討（オプショナル）
- [ ] キャッシュ機構の検討（将来拡張）

---

## 11. 推奨される実装順序

1. **型定義とユーティリティ**（独立して実装・テスト可能）
   - `src/figma/types.ts`
   - `src/figma/url-parser.ts` + テスト

2. **MCP クライアント**（型定義に依存）
   - `src/figma/mcp-client.ts` + テスト

3. **メインモジュール**（上記に依存）
   - `src/figma.ts`
   - `src/constants.ts` の更新

4. **CLI 統合**（メインモジュールに依存）
   - `index.ts` の更新
   - `src/help.ts` の更新

5. **統合テストとドキュメント**
   - `tests/figma-integration.test.ts`
   - README.md の更新

---

## 12. エラーハンドリング戦略

### エラー種別と対処

| エラー種別 | 発生場所 | ユーザーへのメッセージ | 終了コード |
|-----------|---------|---------------------|----------|
| 設定不足 | `validateFigmaConfig()` | "FIGMA_ACCESS_TOKEN is not configured. Set environment variable..." | 1 |
| 無効なノードID | `parseNodeId()` | "Invalid node ID format: '...'. Expected format: '123:456'" | 1 |
| MCP Server 接続失敗 | `callMcpGetImage()` | "Failed to connect to Figma MCP Server at ... Ensure @figma/mcp-server is running." | 1 |
| MCP エラーレスポンス | `callMcpGetImage()` | "Figma MCP Error [code]: message" | 1 |
| ファイル書き込み失敗 | `writeFile()` | "Failed to write capture to file: ..." | 1 |

### リトライ機構（オプショナル）

レート制限対策として、429 エラー時に exponential backoff でリトライする機能を将来追加可能：

```typescript
// src/figma/mcp-client.ts に追加
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;

export const callMcpGetImageWithRetry = async (...args) => {
  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    try {
      return await callMcpGetImage(...args);
    } catch (error) {
      if (error instanceof FigmaMcpError && error.code === 429) {
        const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
        console.warn(`Rate limited. Retrying in ${delay}ms... (attempt ${attempt + 1}/${MAX_RETRIES})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error("Max retries exceeded");
};
```

---

## 13. 将来の拡張候補

- **`figma get-code` コマンド**: MCP の `get_code` ツールを使ってコード抽出
- **バッチキャプチャ**: 複数ノードを一度にキャプチャ
- **キャッシュ機構**: 同じノードの重複取得を避ける
- **プログレスバー**: 大量キャプチャ時の進捗表示
- **出力フォーマット拡張**: WebP, SVG のサポート

---

## まとめ

この実装計画は、既存のコードベース構造（特に `linear` コマンドのパターン）を踏襲し、以下の点を重視しています：

1. **型安全性**: TypeScript の型システムを活用
2. **テスタビリティ**: 各モジュールを独立してテスト可能に設計
3. **エラーハンドリング**: 明確なエラーメッセージとユーザーへのガイダンス
4. **拡張性**: 将来的な機能追加を考慮したモジュール設計
5. **既存パターンとの一貫性**: `linear` コマンドと同様の UX/DX

実装時は上記のチェックリストに従い、段階的にテストしながら進めることを推奨します。
