import { describe, expect, test } from "bun:test";
import {
  convertLocalDateTimeToUtc,
  parseLocalDateTimeInput,
  resolveTimeZone,
} from "../packages/core/src/time";

describe("parseLocalDateTimeInput", () => {
  test("parses YYYYMMDD0000 values", () => {
    const input = parseLocalDateTimeInput("202405300000");
    expect(input).toEqual({
      year: 2024,
      month: 5,
      day: 30,
      hour: 0,
      minute: 0,
    });
  });

  test("defaults to midnight when only date is provided", () => {
    const input = parseLocalDateTimeInput("20240601");
    expect(input).toEqual({
      year: 2024,
      month: 6,
      day: 1,
      hour: 0,
      minute: 0,
    });
  });

  test("rejects malformed values", () => {
    expect(() => parseLocalDateTimeInput("2024-13-01")).toThrow(/Month/);
    expect(() => parseLocalDateTimeInput("2024010112")).toThrow(/Invalid/);
  });
});

describe("resolveTimeZone", () => {
  test("accepts IANA identifiers", () => {
    const { spec, label } = resolveTimeZone("Asia/Tokyo");
    expect(spec).toEqual({ type: "iana", identifier: "Asia/Tokyo" });
    expect(label).toBe("Asia/Tokyo");
  });

  test("accepts numeric offsets", () => {
    const { spec, label } = resolveTimeZone("+0900");
    expect(spec).toEqual({ type: "offset", minutes: 9 * 60 });
    expect(label).toBe("UTC+09:00");
  });
});

describe("convertLocalDateTimeToUtc", () => {
  test("converts offset-based timezones", () => {
    const date = convertLocalDateTimeToUtc(
      { year: 2024, month: 1, day: 1, hour: 0, minute: 0 },
      { type: "offset", minutes: 9 * 60 },
    );
    expect(date.toISOString()).toBe("2023-12-31T15:00:00.000Z");
  });

  test("converts IANA-based timezones (EST)", () => {
    const date = convertLocalDateTimeToUtc(
      { year: 2024, month: 2, day: 1, hour: 0, minute: 0 },
      { type: "iana", identifier: "America/New_York" },
    );
    expect(date.toISOString()).toBe("2024-02-01T05:00:00.000Z");
  });

  test("converts IANA-based timezones (EDT)", () => {
    const date = convertLocalDateTimeToUtc(
      { year: 2024, month: 6, day: 1, hour: 0, minute: 0 },
      { type: "iana", identifier: "America/New_York" },
    );
    expect(date.toISOString()).toBe("2024-06-01T04:00:00.000Z");
  });
});
