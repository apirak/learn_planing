// พจนานุกรม key ของ scores (tgat, a_lv_61, gpax, ...) ฝังอยู่ใน JS bundle ของ course.mytcas.com
import type { ScoreKey } from "../shared/types.ts";

/** path ของ main bundle จาก HTML หน้าเว็บ — ชื่อไฟล์เปลี่ยนทุกครั้งที่เว็บ build ใหม่ */
export function findMainScriptPath(html: string): string {
  const m = html.match(/\/static\/js\/main\.[0-9a-f]+\.chunk\.js/);
  if (!m) throw new Error("ไม่พบ main.*.chunk.js ในหน้าเว็บ — course.mytcas.com อาจเปลี่ยนวิธี build");
  return m[0];
}

/** ดึง JSON.parse('[{"key":...}]') ออกจาก JS — ภายใน '...' ใช้ \' แทน ' */
export function parseScoreKeyDictionary(js: string): ScoreKey[] {
  const m = js.match(/JSON\.parse\('(\[\{"key":.*?\])'\)/);
  if (!m) throw new Error("ไม่พบพจนานุกรม score key ใน JS — course.mytcas.com อาจเปลี่ยนโค้ด");
  return JSON.parse(m[1].replaceAll("\\'", "'"));
}
