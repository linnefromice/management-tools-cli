export type OutputFormat = "json" | "csv";

export const normalizeFormat = (value?: string): OutputFormat =>
  value?.toLowerCase() === "csv" ? "csv" : "json";

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const asString =
    typeof value === "string" ? value : typeof value === "object" ? JSON.stringify(value) : String(value);
  const needsQuotes = /[",\n]/.test(asString);
  const escaped = asString.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

export const arrayToCsv = (rows: Record<string, unknown>[]): string => {
  if (!rows.length) return "";

  const headers = Array.from(
    rows.reduce((set, row) => {
      Object.keys(row).forEach((key) => set.add(key));
      return set;
    }, new Set<string>()),
  );

  const lines = rows.map((row) =>
    headers.map((header) => escapeCsvValue((row as Record<string, unknown>)[header])).join(","),
  );

  return [headers.join(","), ...lines].join("\n");
};

type PrintOptions = {
  collectionKey?: string;
};

const extractRecords = (payload: unknown, collectionKey?: string) => {
  if (!collectionKey) {
    if (Array.isArray(payload)) return payload as Record<string, unknown>[];
    if (payload && typeof payload === "object") return [payload as Record<string, unknown>];
    return [];
  }

  if (!payload || typeof payload !== "object") return [];

  const value = (payload as Record<string, unknown>)[collectionKey];
  if (Array.isArray(value)) return value as Record<string, unknown>[];
  if (value && typeof value === "object") return [value as Record<string, unknown>];
  return [];
};

export const printPayload = (payload: unknown, format: OutputFormat, options?: PrintOptions) => {
  if (format === "csv") {
    if (!options?.collectionKey) {
      console.log(JSON.stringify(payload, null, 2));
      return;
    }
    const records = extractRecords(payload, options.collectionKey);
    console.log(arrayToCsv(records as Record<string, unknown>[]));
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
};
