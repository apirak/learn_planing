import assert from "node:assert/strict";
import { test } from "node:test";
import type { AdmissionRound } from "../../src/shared/types.ts";
import { addRoundsWithData } from "../../src/build/universities-with-rounds.ts";

test("rounds_with_data lists rounds that have data, sorted ascending, without duplicates", () => {
  const r = (university_id: string, round: number) =>
    ({ program_id: "P", university_id, type: `${round}_2570`, round }) as AdmissionRound;
  const result = addRoundsWithData(
    [{ university_id: "001", university_name: "ก", is_accepted_round1: false }, { university_id: "002", university_name: "ข" }],
    [r("001", 3), r("001", 1), r("001", 3), r("001", 2)],
  );
  assert.deepEqual(result, [
    { university_id: "001", university_name: "ก", is_accepted_round1: false, rounds_with_data: [1, 2, 3] },
    { university_id: "002", university_name: "ข", rounds_with_data: [] },
  ]);
});
