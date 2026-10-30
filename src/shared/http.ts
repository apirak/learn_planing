import { setTimeout as sleep } from "node:timers/promises";
import { gunzipSync } from "node:zlib";

/** คืน body เป็นข้อความ หรือ null ถ้า 403/404 (S3 ตอบ 403 เมื่อไม่มีไฟล์) — ลองใหม่ 3 ครั้งถ้า network ล่มหรือ 5xx */
async function fetchBody(url: string): Promise<string | null> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await fetch(url, { headers: { "User-Agent": "Mozilla/5.0" }, signal: AbortSignal.timeout(30_000) });
      if (res.status === 403 || res.status === 404) return null;
      if (!res.ok) throw new Error(`HTTP ${res.status} ${url}`);
      const body = Buffer.from(await res.arrayBuffer());
      // fetch แตก gzip ให้เองเมื่อมี Content-Encoding — กันไว้เผื่อไฟล์บน S3 ถูกเก็บเป็น gzip โดยไม่บอก header
      return (body[0] === 0x1f && body[1] === 0x8b ? gunzipSync(body) : body).toString("utf8");
    } catch (err) {
      if (attempt === 2) throw err;
      await sleep(1000 * 2 ** attempt);
    }
  }
}

export async function fetchText(url: string): Promise<string> {
  const body = await fetchBody(url);
  if (body === null) throw new Error(`ไม่พบ ${url}`);
  return body;
}

export async function fetchJson<T>(url: string): Promise<T> {
  return JSON.parse(await fetchText(url));
}

export async function fetchJsonIfExists<T>(url: string): Promise<T | null> {
  const body = await fetchBody(url);
  return body === null ? null : JSON.parse(body);
}
