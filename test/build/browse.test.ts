import assert from "node:assert/strict";
import { test } from "node:test";
import type { Program, ProgramExam, ScoreKey, University } from "../../src/shared/types.ts";
import { buildBrowse, examWeightsByProgram, subjectsOfKey } from "../../src/build/browse.ts";

const key = (k: string, exam_subjects: string[]): ScoreKey =>
  ({ key: k, label: `ชื่อ ${k}`, max_value: 100, short_label: k, exam_subjects });
const SCORE_KEYS = [
  key("tgat", ["tgat1", "tgat2", "tgat3"]),
  key("tgat1", ["tgat1"]), key("tgat2", ["tgat2"]), key("tgat3", ["tgat3"]),
  key("a_lv_64", ["a_lv_64"]), key("a_lv_65", ["a_lv_65"]), key("a_lv_82", ["a_lv_82"]),
  key("tpat1", []), key("gpax", []),
];
const KEY_MAP = new Map(SCORE_KEYS.map(k => [k.key, k]));

const exam = (program_id: string, components: ProgramExam["components"], min_scores = {}): ProgramExam => ({
  program_id, university_id: "001", round: 1, project_id: null, project_name_th: null,
  receive_student_number: null, min_total_score: null, components, min_scores,
});

test("subjectsOfKey: key → วิชาสอบจริง", () => {
  assert.deepEqual(subjectsOfKey("tgat", KEY_MAP), ["tgat1", "tgat2", "tgat3"]);
  assert.deepEqual(subjectsOfKey("a_lv_82_tscore", KEY_MAP), ["a_lv_82"]);
  assert.deepEqual(subjectsOfKey("tpat1", KEY_MAP), ["tpat1"]); // ไม่มีหน้า blueprint
  assert.deepEqual(subjectsOfKey("ielts", KEY_MAP), ["ielts"]); // ไม่อยู่ในพจนานุกรม
  for (const k of ["gpax", "gpa22", "portfolio", "interview", "priority_score"]) assert.deepEqual(subjectsOfKey(k, KEY_MAP), []);
});

test("น้ำหนัก: ขยาย tgat, ใช้ค่าสูงสุดข้ามรอบ, ขั้นต่ำอย่างเดียว = 0", () => {
  const weights = examWeightsByProgram([
    exam("P1", [{ key: "tgat", weight: 20 }, { key: "a_lv_64", weight: 10 }], { a_lv_65: 30, gpax: 2 }),
    exam("P1", [{ key: "a_lv_64", weight: 40 }]),
    exam("P1", [{ key: "tgat1", weight: 5 }], { tgat2: 50 }), // ต่ำกว่าเดิม → ไม่ทับ
  ], KEY_MAP);
  assert.deepEqual(weights.get("P1"), { tgat1: 20, tgat2: 20, tgat3: 20, a_lv_64: 40, a_lv_65: 0 });
});

test("choose_one_of: ตัวเลือกที่เป็นผลรวมหลายวิชา แบ่งน้ำหนักเท่า ๆ กัน (ปัดครึ่งขึ้น)", () => {
  const weights = examWeightsByProgram([
    exam("P1", [{ key: null, weight: 25, choose_one_of: [["a_lv_82"], ["a_lv_64", "a_lv_65"]] }]),
    exam("P2", [{ key: null, weight: 1, choose_one_of: [["a_lv_64", "a_lv_65"]] }]),
  ], KEY_MAP);
  assert.deepEqual(weights.get("P1"), { a_lv_82: 25, a_lv_64: 13, a_lv_65: 13 });
  assert.deepEqual(weights.get("P2"), { a_lv_64: 1, a_lv_65: 1 }); // 0.5 → 1 ไม่ใช่ 0 (0 = ขั้นต่ำอย่างเดียว)
});

test("buildBrowse: 1 แถวต่อ program_id, หลักสูตรไม่มีสอบ = exams ว่าง, subjects เรียงตาม key", () => {
  const program = (program_id: string, major: string): Program => ({
    program_id, program_name_th: `หลักสูตร ${program_id}`, program_type_name_th: "ไทย (ปกติ)", university_id: "001",
    group_field_id: "30", group_field_th: "วิศวกรรมศาสตร์", field_id: "00", field_name_th: "วิศวกรรมทั่วไป", major,
  });
  const universities: University[] = [{ university_id: "001", university_name: "มหาวิทยาลัย ก" }];
  const browse = buildBrowse(
    [program("P1", "เอก 1"), program("P1", "เอก 2"), program("P2", "")],
    [exam("P1", [{ key: "tgat", weight: 50 }, { key: "a_lv_64", weight: 50 }])],
    SCORE_KEYS,
    universities,
  );
  assert.deepEqual(browse, {
    groups: { "30": "วิศวกรรมศาสตร์" },
    fields: { "30-00": "วิศวกรรมทั่วไป" },
    universities: { "001": "มหาวิทยาลัย ก" },
    subjects: { a_lv_64: "ชื่อ a_lv_64", tgat1: "ชื่อ tgat1", tgat2: "ชื่อ tgat2", tgat3: "ชื่อ tgat3" },
    programs: [
      { id: "P1", name: "หลักสูตร P1", type: "ไทย (ปกติ)", uni: "001", group: "30", field: "30-00",
        exams: { tgat1: 50, tgat2: 50, tgat3: 50, a_lv_64: 50 } },
      { id: "P2", name: "หลักสูตร P2", type: "ไทย (ปกติ)", uni: "001", group: "30", field: "30-00", exams: {} },
    ],
  });
});
