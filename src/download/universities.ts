// ดาวน์โหลดรายชื่อสถาบัน (universities.json)
import { fetchJson } from "../shared/http.ts";
import { S3 } from "../shared/mytcas-urls.ts";
import type { University } from "../shared/types.ts";

export const UNIVERSITIES_URL = `${S3}/universities.json`;

export function downloadUniversities(): Promise<University[]> {
  return fetchJson<University[]>(UNIVERSITIES_URL);
}
