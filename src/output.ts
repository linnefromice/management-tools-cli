import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { ANALYTICS_FIELD_WHITELIST } from "./constants";

export type OutputFormat = "json" | "csv";

export const normalizeFormat = (value?: string): OutputFormat =>
  value?.toLowerCase() === "csv" ? "csv" : "json";

const escapeCsvValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  const asString =
    typeof value === "string"
      ? value
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  const needsQuotes = /[",\n]/.test(asString);
  const escaped = asString.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const filterRecordFields = (record: Record<string, unknown>, collectionKey?: string) => {
  if (!collectionKey) return record;
  const whitelist = ANALYTICS_FIELD_WHITELIST[collectionKey];
  if (!whitelist) return record;

  const filtered: Record<string, unknown> = {};
  whitelist.forEach((field) => {
    if (record[field] !== undefined) {
      filtered[field] = record[field];
    }
  });

  return filtered;
};

const filterCollectionRecords = (records: Record<string, unknown>[], collectionKey?: string) => {
  if (!collectionKey) return records;
  const whitelist = ANALYTICS_FIELD_WHITELIST[collectionKey];
  if (!whitelist) return records;
  return records.map((record) => filterRecordFields(record, collectionKey));
};

const applyAnalyticsFilter = (payload: unknown, collectionKey?: string) => {
  if (!collectionKey) return payload;
  const whitelist = ANALYTICS_FIELD_WHITELIST[collectionKey];
  if (!whitelist) return payload;

  if (!payload || typeof payload !== "object") {
    return payload;
  }

  if (Array.isArray(payload)) {
    return filterCollectionRecords(payload as Record<string, unknown>[], collectionKey);
  }

  const working = { ...(payload as Record<string, unknown>) };
  const value = working[collectionKey];

  if (Array.isArray(value)) {
    working[collectionKey] = filterCollectionRecords(
      value as Record<string, unknown>[],
      collectionKey,
    );
    return working;
  }

  if (value && typeof value === "object") {
    working[collectionKey] = filterRecordFields(value as Record<string, unknown>, collectionKey);
    return working;
  }

  return working;
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
  skipAnalyticsFilter?: boolean;
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

export const renderPayload = (payload: unknown, format: OutputFormat, options?: PrintOptions) => {
  const applyFilter = Boolean(options?.collectionKey) && !options?.skipAnalyticsFilter;
  const filteredPayload = applyFilter
    ? applyAnalyticsFilter(payload, options?.collectionKey)
    : payload;

  if (format === "csv") {
    if (!options?.collectionKey) {
      return JSON.stringify(filteredPayload, null, 2);
    }

    const records = extractRecords(filteredPayload, options.collectionKey);
    const filteredRecords =
      applyFilter && options.collectionKey
        ? filterCollectionRecords(records as Record<string, unknown>[], options.collectionKey)
        : (records as Record<string, unknown>[]);
    return arrayToCsv(filteredRecords as Record<string, unknown>[]);
  }

  return JSON.stringify(filteredPayload, null, 2);
};

export const printPayload = (payload: unknown, format: OutputFormat, options?: PrintOptions) => {
  console.log(renderPayload(payload, format, options));
};

export const writePayload = async (
  payload: unknown,
  format: OutputFormat,
  options: PrintOptions | undefined,
  filePath: string,
) => {
  const output = renderPayload(payload, format, options);
  await mkdir(path.dirname(filePath), { recursive: true });
  await writeFile(filePath, output, "utf-8");
  return filePath;
};
