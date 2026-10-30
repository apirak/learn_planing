// ดาวน์โหลดรอบรับ/โครงการ/สัดส่วนคะแนน ทีละหลักสูตร (admission_rounds.json)
// ไฟล์ดิบเก็บใน data/raw/rounds/ — รันซ้ำจะข้ามที่โหลดแล้ว ลบโฟลเดอร์นี้ถ้าต้องการดึงใหม่ทั้งหมด
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { DATA_DIR } from "../shared/data-files.ts";
import { fetchJsonIfExists } from "../shared/http.ts";
import { mapWithConcurrency } from "../shared/map-with-concurrency.ts";
import { S3 } from "../shared/mytcas-urls.ts";
import type { AdmissionRound, RawAdmissionRound } from "../shared/types.ts";

export const ROUNDS_URL = `${S3}/rounds/{program_id}.json`;
const CACHE_DIR = path.join(DATA_DIR, "raw", "rounds");

async function downloadRoundsOf(programId: string): Promise<RawAdmissionRound[]> {
  const file = path.join(CACHE_DIR, `${programId}.json`);
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
  // S3 ตอบ 403 = หลักสูตรนี้ยังไม่มีข้อมูลรอบรับ
  const rounds = (await fetchJsonIfExists<RawAdmissionRound[]>(ROUNDS_URL.replace("{program_id}", programId))) ?? [];
  await writeFile(file + ".tmp", JSON.stringify(rounds)); // เขียนแล้ว rename กันไฟล์ค้างครึ่งเดียวถ้าโดนหยุดกลางทาง
  await rename(file + ".tmp", file);
  return rounds;
}

export async function downloadAdmissionRounds(programIds: string[]): Promise<AdmissionRound[]> {
  await mkdir(CACHE_DIR, { recursive: true });
  let done = 0;
  const perProgram = await mapWithConcurrency(programIds, 5, async id => {
    const rounds = await downloadRoundsOf(id);
    if (++done % 500 === 0) console.log(`  rounds ${done}/${programIds.length}`);
    return rounds;
  });
  return perProgram.flat().map(r => ({ ...r, round: Number(r.type.split("_")[0]) })); // "3_2570" → 3
}
