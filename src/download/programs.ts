// ดาวน์โหลดหลักสูตรทั้งหมด (programs.json) — เว็บโหลดไฟล์นี้ไฟล์เดียวทั้งก้อน
import { fetchJson } from "../shared/http.ts";
import { S3 } from "../shared/mytcas-urls.ts";
import type { Program } from "../shared/types.ts";

export const PROGRAMS_URL = `${S3}/courses.json`;

export function downloadPrograms(): Promise<Program[]> {
  return fetchJson<Program[]>(PROGRAMS_URL);
}
