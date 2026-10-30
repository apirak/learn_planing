"""ดึงข้อมูล TCAS จาก mytcas เป็น JSON 4 ไฟล์ใน data/

    python3 scrape.py

- universities.json   สถาบัน (S3 ของ course.mytcas.com)
- programs.json       หลักสูตรทั้งหมด (S3)
- admission_rounds.json  รอบรับ/โครงการ/สัดส่วนคะแนน ต่อหลักสูตร (S3, เรียกทีละหลักสูตร)
- exam_subjects.json  โครงสร้างข้อสอบ + ตัวอย่างข้อสอบ (HTML ของ mytcas.com/blueprint)

ไฟล์ดิบของ rounds เก็บใน data/raw/rounds/ — รันซ้ำจะข้ามที่โหลดแล้ว ลบโฟลเดอร์นี้ถ้าต้องการดึงใหม่ทั้งหมด
"""
import gzip
import json
import re
import time
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from pathlib import Path

from bs4 import BeautifulSoup

S3 = "https://my-tcas.s3.ap-southeast-1.amazonaws.com/mytcas"
BLUEPRINT = "https://www.mytcas.com/blueprint/"
OUT = Path(__file__).parent / "data"
RAW_ROUNDS = OUT / "raw" / "rounds"
WORKERS = 5


def fetch(url):
    """คืน bytes, หรือ None ถ้า 403/404 (S3 ตอบ 403 เมื่อไม่มีไฟล์)"""
    req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0", "Accept-Encoding": "gzip"})
    for attempt in range(3):
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            return gzip.decompress(body) if body[:2] == b"\x1f\x8b" else body
        except urllib.error.HTTPError as e:
            if e.code in (403, 404):
                return None
            if attempt == 2:
                raise
        except urllib.error.URLError:
            if attempt == 2:
                raise
        time.sleep(2**attempt)


def fetch_json(url):
    body = fetch(url)
    return None if body is None else json.loads(body)


def save(name, source, data):
    OUT.mkdir(exist_ok=True)
    doc = {
        "fetched_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": source,
        "count": len(data),
        "data": data,
    }
    (OUT / name).write_text(json.dumps(doc, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"{name}: {len(data)} records")


# --- course.mytcas.com ------------------------------------------------------

def scrape_universities(rounds):
    data = fetch_json(f"{S3}/universities.json")
    # is_accepted_roundN ไม่ได้บอกว่าเปิดรับรอบนั้น (เว็บใช้แค่ตอนแสดงรอบ 4) — ใช้รอบที่มีข้อมูลจริงแทน
    by_uni = {}
    for r in rounds:
        by_uni.setdefault(r["university_id"], set()).add(r["round"])
    for u in data:
        u["rounds_with_data"] = sorted(by_uni.get(u["university_id"], ()))
    save("universities.json", f"{S3}/universities.json", data)


def scrape_programs():
    data = fetch_json(f"{S3}/courses.json")
    save("programs.json", f"{S3}/courses.json", data)
    # 1 แถวต่อวิชาเอก (major_name_th) — program_id จึงซ้ำได้
    return list(dict.fromkeys(p["program_id"] for p in data))


def fetch_rounds(program_id):
    path = RAW_ROUNDS / f"{program_id}.json"
    if path.exists():
        return json.loads(path.read_text(encoding="utf-8"))
    rounds = fetch_json(f"{S3}/rounds/{program_id}.json")
    if rounds is None:
        rounds = []  # ยังไม่มีข้อมูลรอบรับ
    tmp = path.with_suffix(".tmp")  # เขียนแล้ว rename กันไฟล์ค้างครึ่งเดียวถ้าโดนหยุดกลางทาง
    tmp.write_text(json.dumps(rounds, ensure_ascii=False), encoding="utf-8")
    tmp.replace(path)
    return rounds


def scrape_rounds(program_ids):
    RAW_ROUNDS.mkdir(parents=True, exist_ok=True)
    data = []
    with ThreadPoolExecutor(WORKERS) as pool:
        for i, rounds in enumerate(pool.map(fetch_rounds, program_ids), 1):
            for r in rounds:
                r["round"] = int(r["type"].split("_")[0])  # "3_2570" -> 3
                data.append(r)
            if i % 500 == 0:
                print(f"  rounds {i}/{len(program_ids)}")
    save("admission_rounds.json", f"{S3}/rounds/{{program_id}}.json", data)
    return data


# --- mytcas.com/blueprint ---------------------------------------------------

def text(el):
    return re.sub(r"\s+", " ", el.get_text(" ", strip=True)).strip() if el else ""


def images(el):
    # ข้ามรูป data: (สัญลักษณ์เล็ก ๆ ฝังในบรรทัด)
    return ["https:" + i["src"] if i["src"].startswith("//") else i["src"]
            for i in el.select("img[src]") if not i["src"].startswith("data:")]


def score_key(slug):
    """slug -> key ที่ใช้ใน admission_rounds.scores: tgat1-91 -> tgat1, a-level-61-math1 -> a_lv_61"""
    m = re.match(r"a-level-(\d+)", slug)
    return f"a_lv_{m[1]}" if m else slug.split("-")[0]


def parse_structure(soup):
    sections, exam_format, duration, notes = [], None, None, None
    for li in soup.select(".stt-body > li"):
        num = li.select_one(".num b")
        h3s = [text(h) for h in li.select(".content h3")]
        topics = [text(h) for h in li.select(".content h4")]
        if num or topics:  # บางวิชา (เช่น ภาษาไทย) ไม่ระบุจำนวนข้อต่อส่วน
            sections.append({
                "title": h3s[0] if h3s else "",
                "topics": topics,
                "questions": text(num) or None,  # อาจเป็นช่วง เช่น "15 - 17"
            })
            continue
        for h in h3s:
            if h.startswith("ประเภทข้อสอบ"):
                exam_format = h.removeprefix("ประเภทข้อสอบ").strip()
            elif h.startswith("ระยะเวลาที่ใช้สอบ"):
                m = re.search(r"\d+", h)
                duration = int(m[0]) if m else h
        if h3s and h3s[0] == "หมายเหตุ":
            notes = text(li.select_one(".content p")) or None
    return sections, exam_format, duration, notes


def parse_question(li):
    answers = li.select_one("ul.bp-answers")
    desc = li.select_one(".bp-desc")
    skip = {"bp-answers", "action", "bp-desc"}
    body = [el for el in li.children
            if getattr(el, "name", None) and el.name not in ("h2", "h3") and not skip & set(el.get("class", []))]
    q = {
        "title": text(li.find("h3")),
        "answer_type": (answers or desc or {}).get("data-ans_type"),
        "question": " ".join(text(el) for el in body),
        "question_images": [src for el in body for src in images(el)],
        "choices": [{
            "no": int(c["data-choice"]),
            "text": text(c.select_one("span")),
            "images": images(c),
            "is_answer": "is_answer" in c.get("class", []),
        } for c in answers.select("li[data-choice]")] if answers else [],
        "answer": desc.get("data-ans") if desc else None,
        "explanation": text(desc.select_one(".bp-info-desc")) if desc else "",
        "explanation_images": images(desc) if desc else [],
    }
    q["explanation"] = q["explanation"].removeprefix("เฉลย/เหตุผลและแนวคิดในการตอบคำถาม").strip()
    return q


def parse_subject(url):
    soup = BeautifulSoup(fetch(url).decode("utf-8"), "html.parser")
    slug = url.rstrip("/").rsplit("/", 1)[1]
    sections, exam_format, duration, notes = parse_structure(soup)
    groups = [g for g in soup.select(".stt-groupnum") if g.select_one(".num b")]  # บางหน้ามี div ว่าง
    # .stt-total มีได้ 2 กล่อง: "จำนวนข้อ" และ "คะแนนเต็ม"; บางหน้าไม่มี "จำนวนข้อ" แต่มีแถว "รวม" ใน groupnum แทน
    totals = {text(t.select_one(".text")): int(text(t.select_one(".num b"))) for t in soup.select(".stt-total")}
    total_questions = totals.get("จำนวนข้อ") or next(
        (int(text(g.select_one(".num b"))) for g in groups if "รวม" in text(g.select_one(".text"))), None)
    return {
        "slug": slug,
        "score_key": score_key(slug),
        "code": re.search(r"-(\d+)", slug)[1],  # tgat1-91 -> 91, a-level-61-math1 -> 61
        "name": text(soup.find("h1")),
        "url": url,
        "intro": text(soup.select_one(".bp-intro")) or None,
        "sections": sections,
        "format": exam_format,
        "duration_min": duration,
        "notes": notes,
        "question_groups": [{"label": text(g.select_one(".text")), "questions": int(text(g.select_one(".num b")))}
                            for g in groups if "รวม" not in text(g.select_one(".text"))],
        "total_questions": total_questions,
        "full_score": totals.get("คะแนนเต็ม"),
        "examples": [parse_question(li) for li in soup.select(".bp-question")],
    }


def scrape_exam_subjects():
    index = BeautifulSoup(fetch(BLUEPRINT).decode("utf-8"), "html.parser")
    urls = list(dict.fromkeys(
        a["href"] if a["href"].startswith("http") else "https://www.mytcas.com" + a["href"]
        for a in index.select("a[href*='/blueprint/']")
        if re.search(r"/blueprint/[^/#]+/?$", a["href"])
    ))
    data = [parse_subject(u) for u in urls]
    save("exam_subjects.json", BLUEPRINT, data)
    return data


def main():
    subjects = scrape_exam_subjects()
    math1 = next(s for s in subjects if s["slug"] == "a-level-61-math1")
    assert len(subjects) >= 20 and len(math1["sections"]) == 4 and math1["duration_min"] == 90, math1
    assert any(c["is_answer"] for c in math1["examples"][1]["choices"])
    assert all(s["sections"] and s["total_questions"] and s["full_score"] for s in subjects), \
        [s["slug"] for s in subjects if not (s["sections"] and s["total_questions"] and s["full_score"])]

    program_ids = scrape_programs()
    rounds = scrape_rounds(program_ids)
    scrape_universities(rounds)


if __name__ == "__main__":
    main()
