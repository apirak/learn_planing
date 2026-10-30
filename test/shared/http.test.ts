import assert from "node:assert/strict";
import { createServer } from "node:http";
import { after, test } from "node:test";
import { gzipSync } from "node:zlib";
import { fetchJson, fetchJsonIfExists, fetchText } from "../../src/shared/http.ts";

let flakyCalls = 0;
const server = createServer((req, res) => {
  if (req.url === "/plain") return res.end("สวัสดี");
  if (req.url === "/gzip-no-header") return res.end(gzipSync('{"a":1}')); // like files on S3
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

test("reads utf-8 text", async () => {
  assert.equal(await fetchText(`${base}/plain`), "สวัสดี");
});

test("decompresses gzip with or without Content-Encoding", async () => {
  assert.deepEqual(await fetchJson(`${base}/gzip-no-header`), { a: 1 });
  assert.deepEqual(await fetchJson(`${base}/gzip-header`), { b: 2 });
});

test("403/404 means missing: fetchJsonIfExists returns null, fetchText throws", async () => {
  assert.equal(await fetchJsonIfExists(`${base}/missing-s3`), null);
  assert.equal(await fetchJsonIfExists(`${base}/missing`), null);
  await assert.rejects(fetchText(`${base}/missing`), /ไม่พบ/);
});

test("retries on 5xx", async () => {
  assert.equal(await fetchText(`${base}/flaky`), "ok");
  assert.equal(flakyCalls, 2);
});
