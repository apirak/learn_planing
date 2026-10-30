// รวมทุกอย่างเป็นไฟล์เล็กไฟล์เดียวสำหรับ ui/ (browse.json)
// 1 แถวต่อหลักสูตร + วิชาที่มีโอกาสต้องสอบ = อยู่ใน components หรือ min_scores ของรอบใดรอบหนึ่ง
import type { Browse, BrowseProgram, Program, ProgramExam, ScoreKey, University } from "../shared/types.ts";

const NOT_EXAM = ["gpa", "portfolio", "interview", "priority_score"]; // เกณฑ์ที่ไม่ใช่การสอบ

/** score key → วิชาสอบจริง: tgat → tgat1/2/3, a_lv_82_tscore → a_lv_82, gpax → [], tpat1 (ไม่มีหน้า blueprint) → tpat1 */
export function subjectsOfKey(key: string, keyMap: Map<string, ScoreKey>): string[] {
  const base = key.replace(/_(tscore|pr)$/, "");
  if (NOT_EXAM.some(prefix => base.startsWith(prefix))) return [];
  const linked = keyMap.get(base)?.exam_subjects;
  return linked?.length ? linked : [base];
}

/** program_id → { วิชา: น้ำหนัก % สูงสุดในทุกรอบ (0 = ใช้แค่คะแนนขั้นต่ำ) } */
export function examWeightsByProgram(programExams: ProgramExam[], keyMap: Map<string, ScoreKey>) {
  const byProgram = new Map<string, Record<string, number>>();
  for (const e of programExams) {
    if (!byProgram.has(e.program_id)) byProgram.set(e.program_id, {});
    const weights = byProgram.get(e.program_id)!;
    for (const c of e.components) {
      // ตัวเลือกใน choose_one_of = ผลรวมของหลายวิชา → แบ่งน้ำหนักเท่า ๆ กัน
      // ponytail: สมมติคะแนนเต็มทุกวิชาเท่ากัน (100) — ถ้าไม่เท่า ต้องถ่วงด้วย max_value ของ score_keys
      const options = c.key === null ? c.choose_one_of : [[c.key]];
      for (const option of options) {
        const weight = Math.round(c.weight / option.length);
        for (const s of option.flatMap(k => subjectsOfKey(k, keyMap))) {
          weights[s] = Math.max(weights[s] ?? 0, weight);
        }
      }
    }
    for (const s of Object.keys(e.min_scores).flatMap(k => subjectsOfKey(k, keyMap))) weights[s] ??= 0;
  }
  return byProgram;
}

export function buildBrowse(
  programs: Program[],
  programExams: ProgramExam[],
  scoreKeys: ScoreKey[],
  universities: University[],
): Browse {
  const keyMap = new Map(scoreKeys.map(k => [k.key, k]));
  const weights = examWeightsByProgram(programExams, keyMap);
  const fieldId = (p: Program) => `${p.group_field_id}-${p.field_id}`;

  const rows = new Map<string, BrowseProgram>(); // programs.json มี 1 แถวต่อวิชาเอก — เก็บแถวแรกของแต่ละ program_id
  for (const p of programs) {
    if (rows.has(p.program_id)) continue;
    rows.set(p.program_id, {
      id: p.program_id,
      name: p.program_name_th,
      type: p.program_type_name_th,
      uni: p.university_id,
      group: p.group_field_id,
      field: fieldId(p),
      exams: weights.get(p.program_id) ?? {},
    });
  }
  const used = [...new Set([...rows.values()].flatMap(r => Object.keys(r.exams)))].sort();
  return {
    groups: Object.fromEntries(programs.map(p => [p.group_field_id, p.group_field_th])),
    fields: Object.fromEntries(programs.map(p => [fieldId(p), p.field_name_th])),
    universities: Object.fromEntries(universities.map(u => [u.university_id, u.university_name])),
    subjects: Object.fromEntries(used.map(s => [s, keyMap.get(s)?.label ?? s])),
    programs: [...rows.values()],
  };
}
