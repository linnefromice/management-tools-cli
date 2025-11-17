type IntlDateTimeFormatPart = ReturnType<Intl.DateTimeFormat["formatToParts"]>[number];

export type TimeZoneSpec =
  | { type: "iana"; identifier: string }
  | { type: "offset"; minutes: number };

export type LocalDateTimeInput = {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
};

const SYSTEM_TIME_ZONE = Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";

const pad = (value: number, width = 2) => value.toString().padStart(width, "0");

const ensureValidDate = (value: LocalDateTimeInput) => {
  const date = new Date(Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute));
  if (
    date.getUTCFullYear() !== value.year ||
    date.getUTCMonth() !== value.month - 1 ||
    date.getUTCDate() !== value.day
  ) {
    throw new Error(
      "Invalid calendar date provided for --window-boundary. Check the day/month combination.",
    );
  }
};

export const parseLocalDateTimeInput = (value: string): LocalDateTimeInput => {
  const digits = value.replace(/\D/g, "");

  if (digits.length !== 8 && digits.length !== 12) {
    throw new Error("Invalid --window-boundary. Use YYYYMMDD or YYYYMMDDHHMM (digits only).");
  }

  const year = Number(digits.slice(0, 4));
  const month = Number(digits.slice(4, 6));
  const day = Number(digits.slice(6, 8));
  const hour = digits.length === 12 ? Number(digits.slice(8, 10)) : 0;
  const minute = digits.length === 12 ? Number(digits.slice(10, 12)) : 0;

  if (
    !Number.isInteger(year) ||
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    !Number.isInteger(hour) ||
    !Number.isInteger(minute)
  ) {
    throw new Error("Invalid numeric value provided for --window-boundary.");
  }

  if (month < 1 || month > 12) {
    throw new Error("Month must be between 01 and 12 for --window-boundary.");
  }

  if (day < 1 || day > 31) {
    throw new Error("Day must be between 01 and 31 for --window-boundary.");
  }

  if (hour < 0 || hour > 23) {
    throw new Error("Hour must be between 00 and 23 for --window-boundary.");
  }

  if (minute < 0 || minute > 59) {
    throw new Error("Minute must be between 00 and 59 for --window-boundary.");
  }

  const result: LocalDateTimeInput = { year, month, day, hour, minute };
  ensureValidDate(result);
  return result;
};

const describeOffset = (minutes: number) => {
  const sign = minutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(minutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const mins = absoluteMinutes % 60;
  return `UTC${sign}${pad(hours)}:${pad(mins)}`;
};

export const resolveTimeZone = (value?: string): { spec: TimeZoneSpec; label: string } => {
  if (!value || value.toLowerCase() === "local") {
    return { spec: { type: "iana", identifier: SYSTEM_TIME_ZONE }, label: SYSTEM_TIME_ZONE };
  }

  const offsetMatch = value.match(/^([+-])(\d{2}):?(\d{2})$/);
  if (offsetMatch) {
    const [, sign, rawHours, rawMinutes] = offsetMatch;
    const hours = Number(rawHours);
    const minutes = Number(rawMinutes);
    const totalMinutes = hours * 60 + minutes;
    const signedMinutes = sign === "-" ? -totalMinutes : totalMinutes;
    return {
      spec: { type: "offset", minutes: signedMinutes },
      label: describeOffset(signedMinutes),
    };
  }

  try {
    // Validate IANA identifier
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return { spec: { type: "iana", identifier: value }, label: value };
  } catch {
    throw new Error(
      `Invalid --timezone value: ${value}. Use an IANA zone (e.g., Asia/Tokyo) or a numeric offset such as +0900.`,
    );
  }
};

const extractParts = (formatter: Intl.DateTimeFormat, date: Date): LocalDateTimeInput => {
  const parts = formatter.formatToParts(date);
  const lookup = new Map<string, IntlDateTimeFormatPart["value"]>();

  parts.forEach((part) => {
    if (part.type !== "literal") {
      lookup.set(part.type, part.value);
    }
  });

  const year = Number(lookup.get("year"));
  const month = Number(lookup.get("month"));
  const day = Number(lookup.get("day"));
  const hour = Number(lookup.get("hour"));
  const minute = Number(lookup.get("minute"));

  if ([year, month, day, hour, minute].some((component) => !Number.isFinite(component))) {
    throw new Error("Failed to extract timezone-adjusted date parts.");
  }

  return { year, month, day, hour, minute };
};

const formatterCache = new Map<string, Intl.DateTimeFormat>();

const getFormatter = (timeZone: string) => {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;

  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
};

const resolveForIanaZone = (value: LocalDateTimeInput, timeZone: string): Date => {
  const targetMs = Date.UTC(value.year, value.month - 1, value.day, value.hour, value.minute);
  let guess = targetMs;
  const formatter = getFormatter(timeZone);

  for (let i = 0; i < 5; i += 1) {
    const guessDate = new Date(guess);
    const parts = extractParts(formatter, guessDate);
    const renderedMs = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute);
    const diff = targetMs - renderedMs;
    if (diff === 0) {
      return guessDate;
    }
    guess += diff;
  }

  throw new Error(`Failed to resolve --window-boundary for timezone "${timeZone}".`);
};

const resolveForOffset = (value: LocalDateTimeInput, offsetMinutes: number): Date => {
  const sign = offsetMinutes >= 0 ? "+" : "-";
  const absoluteMinutes = Math.abs(offsetMinutes);
  const hours = Math.floor(absoluteMinutes / 60);
  const minutes = absoluteMinutes % 60;

  const iso = `${value.year}-${pad(value.month)}-${pad(value.day)}T${pad(value.hour)}:${pad(value.minute)}:00${sign}${pad(hours)}:${pad(minutes)}`;
  const timestamp = Date.parse(iso);
  if (Number.isNaN(timestamp)) {
    throw new Error("Failed to parse --window-boundary with the provided offset.");
  }
  return new Date(timestamp);
};

export const convertLocalDateTimeToUtc = (value: LocalDateTimeInput, spec: TimeZoneSpec): Date => {
  if (spec.type === "offset") {
    return resolveForOffset(value, spec.minutes);
  }
  return resolveForIanaZone(value, spec.identifier);
};
