import assert from "node:assert/strict";
import { test } from "node:test";
import { setTimeout as sleep } from "node:timers/promises";
import { mapWithConcurrency } from "../../src/shared/map-with-concurrency.ts";

test("ผลลัพธ์เรียงตามลำดับเดิม และทำพร้อมกันไม่เกิน limit", async () => {
  let running = 0, peak = 0;
  const result = await mapWithConcurrency([30, 10, 20, 5, 15], 2, async (ms, i) => {
    peak = Math.max(peak, ++running);
    await sleep(ms);
    running--;
    return `${i}:${ms}`;
  });
  assert.deepEqual(result, ["0:30", "1:10", "2:20", "3:5", "4:15"]);
  assert.equal(peak, 2);
});

test("รายการว่าง", async () => {
  assert.deepEqual(await mapWithConcurrency([], 5, async x => x), []);
});
