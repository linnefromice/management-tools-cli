export type ParsedArgs = Record<string, string>;

export class CliUsageError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CliUsageError";
  }
}

export const parseArgs = (args: string[]): ParsedArgs => {
  const result: ParsedArgs = {};

  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (typeof token !== "string" || !token.startsWith("--")) continue;

    const [flag = "", inlineValue] = token.split("=", 2);
    const key = flag.slice(2);

    if (!flag || !key) continue;

    if (inlineValue !== undefined) {
      result[key] = inlineValue;
      continue;
    }

    const next = args[i + 1];
    if (!next || next.startsWith("--")) {
      throw new CliUsageError(`Missing value for --${key}`);
    }

    result[key] = next;
    i += 1;
  }

  return result;
};

export const selectGreeting = (hour: number): string => {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
};

export const formatGreeting = (hour: number, name: string): string => {
  const paddedHour = hour.toString().padStart(2, "0");
  const greeting = selectGreeting(hour);
  return `${greeting}, ${name}! It is ${paddedHour}:00.`;
};

export const resolveGreetingFromArgs = (rawArgs: string[]): string => {
  const args = parseArgs(rawArgs);
  const hourRaw = args.hour;
  const name = args.name;

  if (!hourRaw || !name) {
    throw new CliUsageError("greet requires --hour <HH> and --name <name>");
  }

  const hour = Number(hourRaw);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    throw new CliUsageError("--hour must be an integer between 0 and 23 (HH format)");
  }

  return formatGreeting(hour, name);
};
