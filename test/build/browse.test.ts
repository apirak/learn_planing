import assert from "node:assert/strict";
import { test } from "node:test";
import type { Program, ProgramExam, ScoreKey, University } from "../../src/shared/types.ts";
import { buildBrowse, examWeightsByProgram, otherWeightsByProgram, subjectsOfKey } from "../../src/build/browse.ts";

const key = (k: string, exam_subjects: string[]): ScoreKey =>
  ({ key: k, label: `ชื่อ ${k}`, max_value: 100, short_label: k, exam_subjects });
const SCORE_KEYS = [
  key("tgat", ["tgat1", "tgat2", "tgat3"]),
  key("tgat1", ["tgat1"]), key("tgat2", ["tgat2"]), key("tgat3", ["tgat3"]),
  key("a_lv_64", ["a_lv_64"]), key("a_lv_65", ["a_lv_65"]), key("a_lv_82", ["a_lv_82"]),
  key("tpat1", []), key("gpax", []), key("portfolio", []),
];
const KEY_MAP = new Map(SCORE_KEYS.map(k => [k.key, k]));

const exam = (program_id: string, components: ProgramExam["components"], min_scores = {}): ProgramExam => ({
  program_id, university_id: "001", round: 1, project_id: null, project_name_th: null,
  receive_student_number: null, min_total_score: null, components, min_scores,
});

test("subjectsOfKey maps a score key to the actual exam subjects", () => {
  assert.deepEqual(subjectsOfKey("tgat", KEY_MAP), ["tgat1", "tgat2", "tgat3"]);
  assert.deepEqual(subjectsOfKey("a_lv_82_tscore", KEY_MAP), ["a_lv_82"]);
  assert.deepEqual(subjectsOfKey("tpat1", KEY_MAP), ["tpat1"]); // no blueprint page
  assert.deepEqual(subjectsOfKey("ielts", KEY_MAP), ["ielts"]); // not in the dictionary
  for (const k of ["gpax", "gpa22", "portfolio", "interview", "priority_score"]) assert.deepEqual(subjectsOfKey(k, KEY_MAP), []);
});

test("weights: expands tgat, keeps the max across rounds, min-score only = 0", () => {
  const weights = examWeightsByProgram([
    exam("P1", [{ key: "tgat", weight: 20 }, { key: "a_lv_64", weight: 10 }], { a_lv_65: 30, gpax: 2 }),
    exam("P1", [{ key: "a_lv_64", weight: 40 }]),
    exam("P1", [{ key: "tgat1", weight: 5 }], { tgat2: 50 }), // lower than before → not overwritten
  ], KEY_MAP);
  assert.deepEqual(weights.get("P1"), { tgat1: 20, tgat2: 20, tgat3: 20, a_lv_64: 40, a_lv_65: 0 });
});

test("choose_one_of: an option summing several subjects splits the weight evenly (round half up)", () => {
  const weights = examWeightsByProgram([
    exam("P1", [{ key: null, weight: 25, choose_one_of: [["a_lv_82"], ["a_lv_64", "a_lv_65"]] }]),
    exam("P2", [{ key: null, weight: 1, choose_one_of: [["a_lv_64", "a_lv_65"]] }]),
  ], KEY_MAP);
  assert.deepEqual(weights.get("P1"), { a_lv_82: 25, a_lv_64: 13, a_lv_65: 13 });
  assert.deepEqual(weights.get("P2"), { a_lv_64: 1, a_lv_65: 1 }); // 0.5 → 1, not 0 (0 means min-score only)
});

test("others: non-exam criteria with a real weight, max across rounds; min-score only is skipped", () => {
  const others = otherWeightsByProgram([
    exam("P1", [{ key: "gpax", weight: 100 }]),
    exam("P1", [{ key: "gpax", weight: 40 }, { key: "portfolio", weight: 60 }, { key: "a_lv_64", weight: 0 }], { gpax: 2 }),
    exam("P2", [{ key: "tgat", weight: 100 }], { gpax: 3 }),
  ], KEY_MAP);
  assert.deepEqual(others.get("P1"), { gpax: 100, portfolio: 60 });
  assert.equal(others.has("P2"), false);
});

test("buildBrowse: one row per program_id, no exams = empty exams, gpax-only goes to others, subjects sorted by key", () => {
  const program = (program_id: string, major: string): Program => ({
    program_id, program_name_th: `หลักสูตร ${program_id}`, program_type_name_th: "ไทย (ปกติ)", university_id: "001",
    group_field_id: "30", group_field_th: "วิศวกรรมศาสตร์", field_id: "00", field_name_th: "วิศวกรรมทั่วไป", major,
  });
  const universities: University[] = [{ university_id: "001", university_name: "มหาวิทยาลัย ก" }];
  const browse = buildBrowse(
    [program("P1", "เอก 1"), program("P1", "เอก 2"), program("P2", "")],
    [exam("P1", [{ key: "tgat", weight: 50 }, { key: "a_lv_64", weight: 50 }]), exam("P2", [{ key: "gpax", weight: 100 }])],
    SCORE_KEYS,
    universities,
  );
  assert.deepEqual(browse, {
    groups: { "30": "วิศวกรรมศาสตร์" },
    fields: { "30-00": "วิศวกรรมทั่วไป" },
    universities: { "001": "มหาวิทยาลัย ก" },
    subjects: { a_lv_64: "ชื่อ a_lv_64", gpax: "ชื่อ gpax", tgat1: "ชื่อ tgat1", tgat2: "ชื่อ tgat2", tgat3: "ชื่อ tgat3" },
    programs: [
      { id: "P1", name: "หลักสูตร P1", type: "ไทย (ปกติ)", uni: "001", group: "30", field: "30-00",
        exams: { tgat1: 50, tgat2: 50, tgat3: 50, a_lv_64: 50 }, others: {} },
      { id: "P2", name: "หลักสูตร P2", type: "ไทย (ปกติ)", uni: "001", group: "30", field: "30-00", exams: {}, others: { gpax: 100 } },
    ],
  });
});
