// ดาวน์โหลดหน้า blueprint ทุกวิชา → โครงสร้างข้อสอบ + ตัวอย่างข้อสอบ (exam_subjects.json)
import { findSubjectPageUrls } from "../parse/blueprint-index.ts";
import { parseBlueprintPage } from "../parse/blueprint-page.ts";
import { fetchText } from "../shared/http.ts";
import { mapWithConcurrency } from "../shared/map-with-concurrency.ts";
import { BLUEPRINT } from "../shared/mytcas-urls.ts";
import type { ExamSubject } from "../shared/types.ts";

export async function downloadExamSubjects(): Promise<ExamSubject[]> {
  const urls = findSubjectPageUrls(await fetchText(BLUEPRINT));
  return mapWithConcurrency(urls, 5, async url => parseBlueprintPage(await fetchText(url), url));
}
