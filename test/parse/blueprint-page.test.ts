import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBlueprintPage, scoreKeyFromSlug, textOf } from "../../src/parse/blueprint-page.ts";
import * as cheerio from "cheerio";

// Trimmed-down structure of the real a-level-61-math1 page (made-up text)
const PAGE = `
<h1>A-Level <b>Math1</b></h1>
<div class="bp-intro"><p>คำอธิบาย</p></div>
<ul class="stt-body">
  <li><h3>ข้อสอบประกอบด้วย 2 ส่วน</h3></li>
  <li>
    <div class="content"><h3>ส่วนที่ 1 : พีชคณิต</h3><h4>1) เซต</h4><h4>2) ตรรกศาสตร์</h4></div>
    <div class="num"><span class="_mobile">จำนวน:</span><b>15 - 17</b><span>ข้อ</span></div>
  </li>
  <li><div class="content"><h3>ส่วนที่ 2 : การอ่าน</h3><h4>อ่านจับใจความ</h4></div></li>
  <li><div class="content"><h3>ประเภทข้อสอบ ปรนัย 5 ตัวเลือก</h3><h3>ระยะเวลาที่ใช้สอบ 90 นาที</h3></div></li>
  <li><div class="content"><h3>หมายเหตุ</h3><p>1) บูรณาการ<br>2) ดู <a href="#">เอกสาร</a> ประกอบ</p></div></li>
</ul>
<div class="stt-groupnum"><div class="text">ปรนัย / 75 คะแนน</div><div class="num"><b>25</b><span>ข้อ</span></div></div>
<div class="stt-groupnum"></div>
<div class="stt-groupnum"><span class="text _heading"><b>รวม</b></span><span class="num"><b>30</b> ข้อ</span></div>
<div class="stt-total"><div class="text _heading">คะแนนเต็ม</div><div class="num"><b>100</b> คะแนน</div></div>
<li class="bp-question">
  <h3>ตัวอย่างที่ 1</h3>
  <h4>พิจารณาข้อความ</h4>
  <p><img src="//assets.mytcas.com/q.png"><img src="data:image/png;base64,xx"></p>
  <h2>คำตอบ</h2>
  <ul class="bp-answers -choice" data-ans_type="choice">
    <li class="a-1" data-choice="1"><label><b>1.</b><span>ก ถูก</span></label></li>
    <li class="a-2 is_answer" data-choice="2"><label><b>2.</b><span>ข ถูก</span><img src="https://x/c.png"></label></li>
  </ul>
  <p class="action"><a>คลิกเพื่อดูเฉลย →</a></p>
  <div class="bp-desc -choice" data-ans="2" data-ans_type="choice">
    <div class="bp-info-desc"><h3>เฉลย/เหตุผลและแนวคิดในการตอบคำถาม</h3><p>เพราะ ข</p><p><img src="//assets.mytcas.com/a.png"></p></div>
  </div>
</li>`;

const subject = parseBlueprintPage(PAGE, "https://www.mytcas.com/blueprint/a-level-61-math1/");

test("textOf joins text nodes with spaces in document order", () => {
  const $ = cheerio.load("<p> a <b>b</b>c <!-- x --> </p>");
  assert.equal(textOf($("p")), "a b c");
  assert.equal(textOf($("h1")), "");
});

test("scoreKeyFromSlug converts a page slug to a scores key", () => {
  assert.equal(scoreKeyFromSlug("a-level-61-math1"), "a_lv_61");
  assert.equal(scoreKeyFromSlug("tgat1-91"), "tgat1");
  assert.equal(scoreKeyFromSlug("tpat3-30"), "tpat3");
});

test("subject info", () => {
  assert.equal(subject.slug, "a-level-61-math1");
  assert.equal(subject.score_key, "a_lv_61");
  assert.equal(subject.code, "61");
  assert.equal(subject.name, "A-Level Math1");
  assert.equal(subject.intro, "คำอธิบาย");
});

test("exam structure: sections (with or without question counts), format, duration, notes", () => {
  assert.deepEqual(subject.sections, [
    { title: "ส่วนที่ 1 : พีชคณิต", topics: ["1) เซต", "2) ตรรกศาสตร์"], questions: "15 - 17" },
    { title: "ส่วนที่ 2 : การอ่าน", topics: ["อ่านจับใจความ"], questions: null },
  ]);
  assert.equal(subject.format, "ปรนัย 5 ตัวเลือก");
  assert.equal(subject.duration_min, 90);
  assert.equal(subject.notes, "1) บูรณาการ 2) ดู เอกสาร ประกอบ");
});

test("question counts: skips empty groupnum, uses the 'รวม' (total) row when there is no 'จำนวนข้อ' box", () => {
  assert.deepEqual(subject.question_groups, [{ label: "ปรนัย / 75 คะแนน", questions: 25 }]);
  assert.equal(subject.total_questions, 30);
  assert.equal(subject.full_score, 100);
});

test("the 'จำนวนข้อ' box takes precedence over the 'รวม' row", () => {
  const page = PAGE.replace(`<div class="stt-total">`,
    `<div class="stt-total"><div class="text">จำนวนข้อ</div><div class="num"><b>80</b></div></div><div class="stt-total">`);
  assert.equal(parseBlueprintPage(page, "https://www.mytcas.com/blueprint/a-level-61-math1/").total_questions, 80);
});

test("example question: prompt, images, choices, answer", () => {
  assert.deepEqual(subject.examples, [{
    title: "ตัวอย่างที่ 1",
    answer_type: "choice",
    question: "พิจารณาข้อความ", // excludes h2/h3 headings, choices, button and answer
    question_images: ["https://assets.mytcas.com/q.png"], // skips data: images
    choices: [
      { no: 1, text: "ก ถูก", images: [], is_answer: false },
      { no: 2, text: "ข ถูก", images: ["https://x/c.png"], is_answer: true },
    ],
    answer: "2",
    explanation: "เพราะ ข",
    explanation_images: ["https://assets.mytcas.com/a.png"],
  }]);
});
