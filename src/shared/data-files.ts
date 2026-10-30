import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const DATA_DIR = path.join(import.meta.dirname, "..", "..", "data");

/** รูปแบบของทุกไฟล์ใน data/ */
export type DataFile<T> = { fetched_at: string; source: string; count: number; data: T };

export function nowIso(): string {
  return new Date().toISOString().slice(0, 19) + "+00:00"; // 2026-10-30T05:00:00+00:00
}

export async function saveDataFile<T>(
  name: string,
  source: string,
  data: T,
  { count, fetchedAt }: { count?: number; fetchedAt?: string } = {},
): Promise<void> {
  const doc: DataFile<T> = {
    fetched_at: fetchedAt ?? nowIso(),
    source,
    count: count ?? (data as unknown[]).length,
    data,
  };
  await mkdir(DATA_DIR, { recursive: true });
  await writeFile(path.join(DATA_DIR, name), JSON.stringify(doc, null, 1));
  console.log(`${name}: ${doc.count} records`);
}

export async function loadDataFile<T>(name: string): Promise<DataFile<T>> {
  return JSON.parse(await readFile(path.join(DATA_DIR, name), "utf8"));
}
