// ดึงข้อมูล TCAS จาก mytcas แล้วรวมเป็น JSON ใน data/
//
//   npm run scrape   # ดาวน์โหลดทั้งหมด แล้วสร้างไฟล์รวม
//   npm run browse   # สร้าง browse.json ใหม่จากไฟล์ใน data/ ไม่ดึงเว็บ
//
// src/download/  ดึงจากเว็บ (ไฟล์ดิบตามที่ mytcas ส่งมา)
// src/parse/     แปลง HTML/JS ของเว็บเป็นข้อมูล (ใช้ใน download/)
// src/build/     เอาสิ่งที่ดาวน์โหลดมารวม/แปลงเป็นไฟล์ที่ใช้งาน — ไม่แตะเว็บ
import assert from "node:assert/strict";
import { buildBrowse } from "./build/browse.ts";
import { buildProgramExams } from "./build/program-exams.ts";
import { linkScoreKeysToSubjects } from "./build/score-keys-with-subjects.ts";
import { addRoundsWithData } from "./build/universities-with-rounds.ts";
import { downloadAdmissionRounds, ROUNDS_URL } from "./download/admission-rounds.ts";
import { downloadExamSubjects } from "./download/exam-subjects.ts";
import { downloadPrograms, PROGRAMS_URL } from "./download/programs.ts";
import { downloadScoreKeys } from "./download/score-keys.ts";
import { downloadUniversities, UNIVERSITIES_URL } from "./download/universities.ts";
import { loadDataFile, saveDataFile } from "./shared/data-files.ts";
import { BLUEPRINT } from "./shared/mytcas-urls.ts";
import type { Program, ProgramExam, ScoreKey, University } from "./shared/types.ts";

const BROWSE_SOURCE = "programs.json + program_exams.json + score_keys.json";

async function scrapeAll() {
  const subjects = await downloadExamSubjects();
  // ถ้าหน้าเว็บเปลี่ยนโครงสร้าง ให้ล้มตรงนี้ แทนที่จะได้ไฟล์ว่าง ๆ
  const math1 = subjects.find(s => s.slug === "a-level-61-math1");
  assert.ok(subjects.length >= 20 && math1?.sections.length === 4 && math1.duration_min === 90, "blueprint เปลี่ยนโครงสร้าง");
  assert.ok(math1.examples[1].choices.some(c => c.is_answer), "ไม่พบเฉลยในตัวอย่างข้อสอบ");
  const incomplete = subjects.filter(s => !(s.sections.length && s.total_questions && s.full_score)).map(s => s.slug);
  assert.deepEqual(incomplete, [], "วิชาที่ข้อมูลไม่ครบ");
  await saveDataFile("exam_subjects.json", BLUEPRINT, subjects);

  const programs = await downloadPrograms();
  await saveDataFile("programs.json", PROGRAMS_URL, programs);

  const programIds = [...new Set(programs.map(p => p.program_id))]; // 1 แถวต่อวิชาเอก — program_id จึงซ้ำได้
  const rounds = await downloadAdmissionRounds(programIds);
  await saveDataFile("admission_rounds.json", ROUNDS_URL, rounds);

  const universities = addRoundsWithData(await downloadUniversities(), rounds);
  await saveDataFile("universities.json", UNIVERSITIES_URL, universities);

  const { scriptUrl, scoreKeys: rawScoreKeys } = await downloadScoreKeys();
  const scoreKeys = linkScoreKeysToSubjects(rawScoreKeys, subjects);
  assert.deepEqual(scoreKeys.find(k => k.key === "tgat")?.exam_subjects, ["tgat1", "tgat2", "tgat3"]);
  await saveDataFile("score_keys.json", scriptUrl, scoreKeys);

  const programExams = buildProgramExams(rounds, scoreKeys);
  await saveDataFile("program_exams.json", "admission_rounds.json + score_keys.json", programExams);

  const browse = buildBrowse(programs, programExams, scoreKeys, universities);
  await saveDataFile("browse.json", BROWSE_SOURCE, browse, { count: browse.programs.length });
}

/** สร้าง browse.json ใหม่จากไฟล์ใน data/ โดยไม่ดึงเว็บ — fetched_at ใช้ของ programs.json */
async function rebuildBrowse() {
  const programs = await loadDataFile<Program[]>("programs.json");
  const browse = buildBrowse(
    programs.data,
    (await loadDataFile<ProgramExam[]>("program_exams.json")).data,
    (await loadDataFile<ScoreKey[]>("score_keys.json")).data,
    (await loadDataFile<University[]>("universities.json")).data,
  );
  await saveDataFile("browse.json", BROWSE_SOURCE, browse, { count: browse.programs.length, fetchedAt: programs.fetched_at });
}

await (process.argv[2] === "browse" ? rebuildBrowse() : scrapeAll());
