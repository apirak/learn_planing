import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdmissionRound, ScoreKey } from "../../src/shared/types.ts";
import { buildProgramExams, minScores, scoreComponents } from "../../src/build/program-exams.ts";

const key = (k: string): ScoreKey => ({ key: k, label: k, max_value: 100, short_label: k });
const SCORE_KEYS = ["tgat", "tpat3", "a_lv_61", "a_lv_64", "a_lv_65", "gpax"].map(key);

const round = (extra: Partial<AdmissionRound>): AdmissionRound =>
  ({ program_id: "P1", university_id: "001", type: "3_2570", round: 3, project_id: "x", ...extra });

test("scores ปกติ: key → น้ำหนัก", () => {
  assert.deepEqual(scoreComponents({ tgat: 20, tpat3: 30 }), [
    { key: "tgat", weight: 20 },
    { key: "tpat3", weight: 30 },
  ]);
  assert.deepEqual(scoreComponents(null), []);
});

test("cal_subject_name: '|' = หรือ, เว้นวรรค = ผลรวม; ต่อท้ายวิชาปกติ", () => {
  assert.deepEqual(scoreComponents({
    cal_subject_name: " a_lv_64 | a_lv_65  a_lv_66 ", cal_score_sum: 20, cal_type: "max", tgat: 80,
  }), [
    { key: "tgat", weight: 80 },
    { key: null, weight: 20, choose_one_of: [["a_lv_64"], ["a_lv_65", "a_lv_66"]] },
  ]);
});

test("min_scores: เอาเฉพาะ min_* ที่เป็นตัวเลข แล้วตัด min_ ออก", () => {
  assert.deepEqual(minScores({ min_tgat: 30, min_gpax: 2.5, min_note: "ดูประกาศ", max_age: 25 }), { tgat: 30, gpax: 2.5 });
  assert.deepEqual(minScores(undefined), {});
});

test("ข้ามรอบที่ไม่ต้องสอบ: ไม่มีสัดส่วนคะแนน และขั้นต่ำมีแค่เกรด", () => {
  const exams = buildProgramExams([
    round({ scores: {}, score_conditions: { min_gpax: 3 } }), // portfolio + GPAX → ข้าม
    round({ round: 1, scores: {}, score_conditions: { min_tgat: 40 } }), // มีคะแนนสอบขั้นต่ำ → เก็บ
    round({ round: 2, scores: { tgat: 100 }, receive_student_number: 10 }),
  ], SCORE_KEYS);
  assert.deepEqual(exams.map(e => e.round), [1, 2]);
  assert.deepEqual(exams[1], {
    program_id: "P1", university_id: "001", round: 2, project_id: "x", project_name_th: null,
    receive_student_number: 10, min_total_score: null, components: [{ key: "tgat", weight: 100 }], min_scores: {},
  });
});

test("score key ที่ไม่รู้จัก = error (เว็บเพิ่ม key ใหม่)", () => {
  assert.throws(() => buildProgramExams([round({ scores: { new_exam: 50 } })], SCORE_KEYS), /new_exam/);
});
