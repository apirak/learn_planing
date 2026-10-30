import assert from "node:assert/strict";
import { test } from "node:test";
import { findSubjectPageUrls } from "../../src/parse/blueprint-index.ts";

test("keeps only unique subject page links and makes relative links absolute", () => {
  const html = `
    <a href="/blueprint/">หน้ารวม</a>
    <a href="/blueprint/tgat1-91/">TGAT1</a>
    <a href="https://www.mytcas.com/blueprint/tgat1-91/">TGAT1 ซ้ำ</a>
    <a href="/blueprint/tgat1-91/#example">anchor</a>
    <a href="https://www.mytcas.com/blueprint/a-level-61-math1">Math1</a>
    <a href="/news/">ข่าว</a>`;
  assert.deepEqual(findSubjectPageUrls(html), [
    "https://www.mytcas.com/blueprint/tgat1-91/",
    "https://www.mytcas.com/blueprint/a-level-61-math1",
  ]);
});
