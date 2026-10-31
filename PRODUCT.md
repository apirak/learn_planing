# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Primary: OnDemand sales and academic-advising staff, using the tool during a conversation with a student (ม.ปลาย) or parent to recommend which courses to take and in what order. Planned later: opened for customers (students/parents) to use directly — exact customer-facing scope is undecided.

## Product Purpose
Course Planner turns a student's target program (คณะ/หลักสูตร/สถาบัน on mytcas), today's date, and per-subject aptitude into a recommended course list, ordering, per-course reasoning, and a study schedule up to each exam date. Success: staff can produce a defensible, personalised plan in one sitting.

## Positioning
Plans are derived from real mytcas blueprint weights and exam dates mapped onto OnDemand's own course catalogue (พื้นฐาน / เนื้อหา / โจทย์ levels), so every recommendation can show *why*: subject weight, time remaining, aptitude.

## Operating Context
- Data scraped from mytcas.com (blueprint, programs) via `pnpm scrape`; browsed locally with `pnpm dev` (`ui/index.html`).
- Exams: TGAT/TPAT, A-Level; Thai academic-year conventions.
- Used live alongside a student/parent, so results must be explainable aloud.

## Capabilities and Constraints
- Inputs: program + institution, current date, aptitude per subject. Outputs: ordered courses, reasons, schedule.
- Algorithm is still a draft (README.md); course ↔ exam-subject mapping is not yet complete.
- PDPA: student data (minors) is personal data — keep it out of URLs, logs and shared outputs. Customer-facing views must not expose internal pricing strategy or unreleased plans.
- Undecided: whether customers get the same UI as staff or a separate surface.

## Evidence on Hand
Scraped mytcas data under `data/`. No testimonials, usage metrics or outcome data exist — do not fabricate them.

## Product Principles
1. Every recommendation shows its reason.
2. Source data from mytcas stays traceable and current.
3. Fast enough to use mid-conversation.
4. Protect student data by default.

## Notes
`DESIGN.md` (Sentry-style) is a reference only, not a binding visual direction.
