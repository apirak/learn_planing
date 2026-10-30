import assert from "node:assert/strict";
import { test } from "node:test";
import { findMainScriptPath, parseScoreKeyDictionary } from "../../src/parse/score-key-dictionary.ts";

test("หา path ของ main bundle", () => {
  const html = `<script src="/static/js/2.abc123.chunk.js"></script><script src="/static/js/main.9f8e7d.chunk.js"></script>`;
  assert.equal(findMainScriptPath(html), "/static/js/main.9f8e7d.chunk.js");
  assert.throws(() => findMainScriptPath("<html></html>"));
});

test("ดึงพจนานุกรมจาก JSON.parse('...') และแก้ \\' กลับเป็น '", () => {
  const js = `var a=1;const k=JSON.parse('[{"key":"tgat","label":"TGAT (ความถนัดทั่วไป)","max_value":300,"short_label":"TGAT"},{"key":"x","label":"Children\\'s","max_value":100,"short_label":"X"}]');var b=2;`;
  assert.deepEqual(parseScoreKeyDictionary(js), [
    { key: "tgat", label: "TGAT (ความถนัดทั่วไป)", max_value: 300, short_label: "TGAT" },
    { key: "x", label: "Children's", max_value: 100, short_label: "X" },
  ]);
  assert.throws(() => parseScoreKeyDictionary("var a=1;"));
});
