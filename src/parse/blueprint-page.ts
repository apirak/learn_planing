// แปลง HTML หน้า mytcas.com/blueprint/<วิชา>/ เป็นโครงสร้างข้อสอบ + ตัวอย่างข้อสอบ
import * as cheerio from "cheerio";
import type { AnyNode } from "domhandler";
import type { ExamSubject, ExampleQuestion } from "../shared/types.ts";

type Selection = cheerio.Cheerio<AnyNode>;

/** ข้อความใน element แรก — เว้นวรรคระหว่าง text node และยุบช่องว่างซ้ำ (ไม่มี element = "") */
export function textOf(el: Selection): string {
  const parts: string[] = [];
  const walk = (nodes: AnyNode[]) => {
    for (const node of nodes) {
      if (node.type === "text") parts.push(node.data.trim());
      else if (node.type === "tag") walk(node.children); // ข้าม comment, script, style
    }
  };
  walk(el.first().toArray());
  return parts.filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
}

/** src ของรูปใน element — ข้ามรูป data: (สัญลักษณ์เล็ก ๆ ฝังในบรรทัด), เติม https: ให้ //host */
function imagesIn(el: Selection): string[] {
  return el.find("img[src]").toArray()
    .map(img => img.attribs.src)
    .filter(src => !src.startsWith("data:"))
    .map(src => (src.startsWith("//") ? "https:" + src : src));
}

/** slug → key ที่ใช้ใน admission_rounds.scores: tgat1-91 → tgat1, a-level-61-math1 → a_lv_61 */
export function scoreKeyFromSlug(slug: string): string {
  const m = slug.match(/^a-level-(\d+)/);
  return m ? `a_lv_${m[1]}` : slug.split("-")[0];
}

/** ตาราง "โครงสร้างข้อสอบ": ส่วนต่าง ๆ + ประเภทข้อสอบ + เวลาสอบ + หมายเหตุ */
function parseStructure($: cheerio.CheerioAPI) {
  const sections: ExamSubject["sections"] = [];
  let format: string | null = null;
  let durationMin: number | string | null = null;
  let notes: string | null = null;

  for (const li of $(".stt-body > li").toArray().map(el => $(el))) {
    const num = li.find(".num b");
    const h3s = li.find(".content h3").toArray().map(h => textOf($(h)));
    const topics = li.find(".content h4").toArray().map(h => textOf($(h)));
    if (num.length || topics.length) { // บางวิชา (เช่น ภาษาไทย) ไม่ระบุจำนวนข้อต่อส่วน
      sections.push({ title: h3s[0] ?? "", topics, questions: textOf(num) || null }); // อาจเป็นช่วง เช่น "15 - 17"
      continue;
    }
    for (const h of h3s) {
      if (h.startsWith("ประเภทข้อสอบ")) format = h.slice("ประเภทข้อสอบ".length).trim();
      else if (h.startsWith("ระยะเวลาที่ใช้สอบ")) {
        const m = h.match(/\d+/);
        durationMin = m ? Number(m[0]) : h;
      }
    }
    if (h3s[0] === "หมายเหตุ") notes = textOf(li.find(".content p")) || null;
  }
  return { sections, format, durationMin, notes };
}

function parseExampleQuestion($: cheerio.CheerioAPI, li: Selection): ExampleQuestion {
  const answers = li.find("ul.bp-answers").first();
  const desc = li.find(".bp-desc").first();
  // ตัวโจทย์ = ลูกตรงของ li ยกเว้นหัวข้อ, ตัวเลือก, ปุ่ม และเฉลย
  const body = li.children().filter((_, el) =>
    !["h2", "h3"].includes(el.tagName) && !["bp-answers", "action", "bp-desc"].some(c => $(el).hasClass(c)));
  const bodyParts = body.toArray().map(el => $(el));
  const explanation = textOf(desc.find(".bp-info-desc"));
  return {
    title: textOf(li.find("h3")),
    answer_type: (answers.length ? answers : desc).attr("data-ans_type") ?? null,
    question: bodyParts.map(textOf).filter(Boolean).join(" "), // ข้ามย่อหน้าที่มีแต่รูป
    question_images: bodyParts.flatMap(imagesIn),
    choices: answers.find("li[data-choice]").toArray().map(c => ({
      no: Number(c.attribs["data-choice"]),
      text: textOf($(c).find("span")),
      images: imagesIn($(c)),
      is_answer: $(c).hasClass("is_answer"),
    })),
    answer: desc.attr("data-ans") ?? null,
    explanation: explanation.replace(/^เฉลย\/เหตุผลและแนวคิดในการตอบคำถาม/, "").trim(),
    explanation_images: imagesIn(desc),
  };
}

export function parseBlueprintPage(html: string, url: string): ExamSubject {
  const $ = cheerio.load(html);
  const slug = url.replace(/\/+$/, "").split("/").at(-1)!;
  const { sections, format, durationMin, notes } = parseStructure($);
  const groups = $(".stt-groupnum").toArray().map(g => $(g))
    .filter(g => g.find(".num b").length) // บางหน้ามี div ว่าง
    .map(g => ({ label: textOf(g.find(".text")), questions: Number(textOf(g.find(".num b"))) }));
  // .stt-total มีได้ 2 กล่อง: "จำนวนข้อ" และ "คะแนนเต็ม"; บางหน้าไม่มี "จำนวนข้อ" แต่มีแถว "รวม" ใน groupnum แทน
  const totals = Object.fromEntries($(".stt-total").toArray().map(t =>
    [textOf($(t).find(".text")), Number(textOf($(t).find(".num b")))]));
  const totalQuestions = totals["จำนวนข้อ"] || (groups.find(g => g.label.includes("รวม"))?.questions ?? null);

  return {
    slug,
    score_key: scoreKeyFromSlug(slug),
    code: slug.match(/-(\d+)/)![1], // tgat1-91 → 91, a-level-61-math1 → 61
    name: textOf($("h1")),
    url,
    intro: textOf($(".bp-intro")) || null,
    sections,
    format,
    duration_min: durationMin,
    notes,
    question_groups: groups.filter(g => !g.label.includes("รวม")),
    total_questions: totalQuestions,
    full_score: totals["คะแนนเต็ม"] ?? null,
    examples: $(".bp-question").toArray().map(li => parseExampleQuestion($, $(li))),
  };
}
