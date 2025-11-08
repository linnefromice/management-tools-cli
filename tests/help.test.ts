import { describe, expect, test } from "bun:test";
import { getUsageText, getLinearUsageText } from "../src/help";

describe("getUsageText", () => {
  test("lists greet command", () => {
    const usage = getUsageText();
    expect(usage).toContain("bun run index.ts greet --hour <HH> --name <YourName>");
  });

  test("lists linear sync command", () => {
    const usage = getUsageText();
    expect(usage).toContain("bun run index.ts linear sync");
  });

  test("mentions format flag", () => {
    const usage = getUsageText();
    expect(usage).toContain("[--format csv]");
  });

  test("mentions remote flag", () => {
    const usage = getUsageText();
    expect(usage).toContain("[--remote]");
  });

  test("mentions output flag", () => {
    const usage = getUsageText();
    expect(usage).toContain("[--output <PATH>]");
  });
});

describe("getLinearUsageText", () => {
  test("includes projects subcommand", () => {
    const usage = getLinearUsageText();
    expect(usage).toContain("bun run index.ts linear projects [--full] [--format csv] [--remote]");
  });

  test("includes search-issues filters", () => {
    const usage = getLinearUsageText();
    expect(usage).toContain(
      "linear search-issues [--project <ID>] [--label <ID>] [--cycle <ID>] [--format csv]",
    );
  });
});
