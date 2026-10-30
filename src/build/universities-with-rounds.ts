// เติม rounds_with_data ให้แต่ละสถาบัน จากรอบรับที่ดาวน์โหลดมา
// is_accepted_roundN ไม่ได้บอกว่าเปิดรับรอบนั้น (เว็บใช้แค่ตอนแสดงรอบ 4) — ใช้รอบที่มีข้อมูลจริงแทน
import type { AdmissionRound, University } from "../shared/types.ts";

export function addRoundsWithData(universities: University[], rounds: AdmissionRound[]): University[] {
  const roundsByUni = new Map<string, Set<number>>();
  for (const r of rounds) {
    if (!roundsByUni.has(r.university_id)) roundsByUni.set(r.university_id, new Set());
    roundsByUni.get(r.university_id)!.add(r.round);
  }
  return universities.map(u => ({
    ...u,
    rounds_with_data: [...(roundsByUni.get(u.university_id) ?? [])].sort((a, b) => a - b),
  }));
}
