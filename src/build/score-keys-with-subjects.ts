// เติม exam_subjects ให้แต่ละ score key: วิชาใน exam_subjects.json ที่ key นี้หมายถึง
import type { ExamSubject, ScoreKey } from "../shared/types.ts";

export function linkScoreKeysToSubjects(scoreKeys: ScoreKey[], subjects: ExamSubject[]): ScoreKey[] {
  const subjectKeys = subjects.map(s => s.score_key);
  return scoreKeys.map(k => ({
    ...k,
    // tgat → tgat1/2/3 (รวม 3 ส่วน), tpat21 → tpat2 (ส่วนย่อย), a_lv_61 → a_lv_61; gpax/portfolio → []
    exam_subjects: subjectKeys.filter(s => s.startsWith(k.key) || k.key.startsWith(s)),
  }));
}
