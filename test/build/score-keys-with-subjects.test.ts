import assert from "node:assert/strict";
import { test } from "node:test";
import type { ExamSubject, ScoreKey } from "../../src/shared/types.ts";
import { linkScoreKeysToSubjects } from "../../src/build/score-keys-with-subjects.ts";

test("links each score key to its exam_subjects", () => {
  const subjects = ["tgat1", "tgat2", "tgat3", "tpat2", "a_lv_61"].map(score_key => ({ score_key }) as ExamSubject);
  const keys = ["tgat", "tgat2", "tpat21", "a_lv_61", "gpax"].map(key => ({ key }) as ScoreKey);
  const linked = Object.fromEntries(linkScoreKeysToSubjects(keys, subjects).map(k => [k.key, k.exam_subjects]));
  assert.deepEqual(linked, {
    tgat: ["tgat1", "tgat2", "tgat3"], // all 3 parts
    tgat2: ["tgat2"],
    tpat21: ["tpat2"], // a part of tpat2
    a_lv_61: ["a_lv_61"],
    gpax: [], // not an exam
  });
});
