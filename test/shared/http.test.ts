import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { gzipSync } from "node:zlib";
import { fetchJson, fetchJsonIfExists, fetchText } from "../../src/shared/http.ts";

let flakyCalls = 0;
const server = createServer((req, res) => {
  if (req.url === "/plain") return res.end("สวัสดี");
  if (req.url === "/gzip-no-header") return res.end(gzipSync('{"a":1}')); // แบบไฟล์บน S3
  if (req.url === "/gzip-header") {
    res.setHeader("Content-Encoding", "gzip");
    return res.end(gzipSync('{"b":2}'));
  }
  if (req.url === "/flaky") return ++flakyCalls === 1 ? res.writeHead(500).end() : res.end("ok");
  res.writeHead(req.url === "/missing-s3" ? 403 : 404).end();
});
await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
after(() => server.close());

test("อ่านข้อความ utf-8", async () => {
  assert.equal(await fetchText(`${base}/plain`), "สวัสดี");
});

test("แตก gzip ทั้งแบบมีและไม่มี Content-Encoding", async () => {
  assert.deepEqual(await fetchJson(`${base}/gzip-no-header`), { a: 1 });
  assert.deepEqual(await fetchJson(`${base}/gzip-header`), { b: 2 });
});

test("403/404 = ไม่มีไฟล์: fetchJsonIfExists คืน null, fetchText โยน error", async () => {
  assert.equal(await fetchJsonIfExists(`${base}/missing-s3`), null);
  assert.equal(await fetchJsonIfExists(`${base}/missing`), null);
  await assert.rejects(fetchText(`${base}/missing`), /ไม่พบ/);
});

test("5xx ลองใหม่", async () => {
  assert.equal(await fetchText(`${base}/flaky`), "ok");
  assert.equal(flakyCalls, 2);
});
