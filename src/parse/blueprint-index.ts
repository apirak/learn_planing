// หาลิงก์หน้าวิชาจากหน้ารวม mytcas.com/blueprint/
import * as cheerio from "cheerio";

export function findSubjectPageUrls(indexHtml: string): string[] {
  const $ = cheerio.load(indexHtml);
  const urls = $("a[href*='/blueprint/']").toArray()
    .map(a => a.attribs.href)
    .filter(href => /\/blueprint\/[^/#]+\/?$/.test(href))
    .map(href => (href.startsWith("http") ? href : "https://www.mytcas.com" + href));
  return [...new Set(urls)];
}
