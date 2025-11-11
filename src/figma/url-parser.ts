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
      throw new Error(`No node-id parameter found in URL: ${input}`);
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
