// ดาวน์โหลดพจนานุกรม key ของ scores จาก JS bundle ของ course.mytcas.com (score_keys.json ก่อนเติม exam_subjects)
import { findMainScriptPath, parseScoreKeyDictionary } from "../parse/score-key-dictionary.ts";
import { fetchText } from "../shared/http.ts";
import { COURSE_SITE } from "../shared/mytcas-urls.ts";
import type { ScoreKey } from "../shared/types.ts";

export async function downloadScoreKeys(): Promise<{ scriptUrl: string; scoreKeys: ScoreKey[] }> {
  const scriptUrl = COURSE_SITE + findMainScriptPath(await fetchText(`${COURSE_SITE}/universities`));
  return { scriptUrl, scoreKeys: parseScoreKeyDictionary(await fetchText(scriptUrl)) };
}
