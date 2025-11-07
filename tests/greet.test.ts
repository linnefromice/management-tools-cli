import { describe, expect, test } from "bun:test";
import { parseArgs, resolveGreetingFromArgs, selectGreeting } from "../src/greet";

describe("parseArgs", () => {
  test("captures long-form flags", () => {
    const parsed = parseArgs(["--hour", "09", "--name", "Taro"]);
    expect(parsed).toEqual({ hour: "09", name: "Taro" });
  });

  test("supports inline assignment", () => {
    const parsed = parseArgs(["--hour=18", "--name=Hanako"]);
    expect(parsed).toEqual({ hour: "18", name: "Hanako" });
  });
});

describe("selectGreeting", () => {
  test("night hours", () => {
    expect(selectGreeting(2)).toBe("Good night");
  });
  test("morning hours", () => {
    expect(selectGreeting(9)).toBe("Good morning");
  });
  test("afternoon hours", () => {
    expect(selectGreeting(16)).toBe("Good afternoon");
  });
  test("evening hours", () => {
    expect(selectGreeting(20)).toBe("Good evening");
  });
});

describe("resolveGreetingFromArgs", () => {
  test("formats friendly message", () => {
    const result = resolveGreetingFromArgs(["--hour", "7", "--name", "Sora"]);
    expect(result).toBe("Good morning, Sora! It is 07:00.");
  });

  test("throws for missing flags", () => {
    expect(() => resolveGreetingFromArgs(["--hour", "7"])).toThrow();
  });

  test("throws for invalid hour", () => {
    expect(() => resolveGreetingFromArgs(["--hour", "42", "--name", "Alex"])).toThrow();
  });
});
