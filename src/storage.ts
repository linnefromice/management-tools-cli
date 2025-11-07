import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const STORAGE_ROOT = path.resolve(process.cwd(), "storage");
const LINEAR_DIR = path.join(STORAGE_ROOT, "linear");

const ensureDir = async (dir: string) => {
  await mkdir(dir, { recursive: true });
};

export type StoredDataset<T> = {
  fetchedAt: string;
  count: number;
  items: T[];
};

export const writeLinearDataset = async <T>(
  name: string,
  payload: StoredDataset<T>,
): Promise<string> => {
  await ensureDir(LINEAR_DIR);
  const target = path.join(LINEAR_DIR, `${name}.json`);
  await writeFile(target, JSON.stringify(payload, null, 2), "utf-8");
  return target;
};

export const getLinearStorageDir = () => LINEAR_DIR;
