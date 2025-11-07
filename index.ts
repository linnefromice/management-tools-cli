type ParsedArgs = Record<string, string>;

const [, , command, ...rawArgs] = process.argv;

const usage = `Usage: bun run index.ts greet --hour <HH> --name <YourName>`;

if (!command) {
  console.log(usage);
  process.exit(1);
}

const parseArgs = (args: string[]): ParsedArgs => {
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
      throw new Error(`Missing value for --${key}`);
    }

    result[key] = next;
    i += 1;
  }

  return result;
};

const greet = () => {
  const args = parseArgs(rawArgs);
  const hourRaw = args.hour;
  const name = args.name;

  if (!hourRaw || !name) {
    console.error("greet requires --hour <HH> and --name <name>");
    process.exit(1);
  }

  const hour = Number(hourRaw);

  if (!Number.isInteger(hour) || hour < 0 || hour > 23) {
    console.error("--hour must be an integer between 0 and 23 (HH format)");
    process.exit(1);
  }

  const paddedHour = hour.toString().padStart(2, "0");

  let greeting: string;
  if (hour < 5) greeting = "Good night";
  else if (hour < 12) greeting = "Good morning";
  else if (hour < 18) greeting = "Good afternoon";
  else greeting = "Good evening";

  console.log(`${greeting}, ${name}! It is ${paddedHour}:00.`);
};

switch (command) {
  case "greet":
    greet();
    break;
  default:
    console.error(`Unknown command: ${command}`);
    console.log(usage);
    process.exit(1);
}
