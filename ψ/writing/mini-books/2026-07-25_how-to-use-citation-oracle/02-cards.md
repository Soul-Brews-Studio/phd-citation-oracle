## §2 — corpus เป็น markdown ไม่ใช่ database

**62 paper cards ใน `ψ/papers/` — filename คือ citekey คือ `\cite{}` key ตัวเดียวกัน** ไม่มีชั้นแปลระหว่างกลาง เปิดไฟล์ `mahajan2025.md` เจอ ก็เขียน `\cite{mahajan2025}` ในธีสิสได้เลย ไม่ต้อง lookup ตารางไหนทั้งนั้น พิสูจน์จาก `citation status` บรรทัดจริง

```
✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
```

Cards คือ source of truth — ไม่ใช่ `artifacts/literature_corpus.jsonl`. JSONL เป็นแค่ import format: `maw citation cards` อ่าน JSONL แล้วสร้าง/อัปเดต card แต่ทุกอย่างใต้หัว `## Notes` กับ `doi:` ที่เติมมือ **รอด** ทุกครั้งที่รัน ไม่ถูกทับ

สังเกตตัวเลข: JSONL มี 56 papers แต่การ์ดมี 62 — ต่างกัน 6 ใบ นั่นคือหลักฐานตรงตัวว่าการ์ดโตกว่า JSONL ไปแล้ว การ์ดใหม่พวกนี้ไม่ได้ sync กลับลง JSONL เพราะทิศทางข้อมูลเดินทางเดียว: JSONL → cards เท่านั้น ไม่มีทิศกลับ

ตัวอย่างการ์ดจริง (ตัดสั้น) — frontmatter YAML บนสุด ตามด้วย body สามบรรทัดคงที่ แล้วปิดท้ายด้วย `## Notes`:

```markdown
---
citekey: mahajan2025
id: "2.1.4"
title: "Dynamic calibration of low-cost PM2.5 sensors using trust-based consensus mechanisms"
short_title: "Trust-Based Dynamic Calibration"
authors:
  - "Mahajan, S."
  - "Helbing, D."
year: "2025"
journal: "npj Climate and Atmospheric Science"
quartile: "Q1"
impact_factor: "9.0"
volume: "8"
issue: "1"
pages: "257"
doi: "10.1038/s41612-025-01145-2"
topic: "low-cost-sensor-calibration"
status: ok
verified: "crossref 2026-07-25"
tags: [paper, low-cost-sensor-calibration]
kind: paper
---

# Mahajan & Helbing (2025) — Trust-Based Dynamic Calibration

**Key findings** — 4-indicator trust framework...

**Thesis relevance** — HIGHEST CONCEPTUAL ALIGNMENT...

**Full citation** — Mahajan, S., & Helbing, D. (2025)...

## Notes

<!-- Your notes go here. `maw citation cards` preserves everything under this heading. -->
```

frontmatter เต็มมี 20 field: `citekey id title short_title authors[] year journal quartile impact_factor volume issue pages doi topic status verified aka authors_upstream tags kind` — ใบนี้ไม่มี `aka` กับ `authors_upstream` เพราะ optional ใช้เมื่อมี alias ชื่อผู้เขียนต้นทางเท่านั้น

Body สามบรรทัดตายตัว: **Key findings**, **Thesis relevance**, **Full citation** — แล้ว `## Notes` คือช่องของ oracle เอง เขียนอะไรก็ได้ใต้นั้น ไม่หาย

ตัวอย่างจริง — `jarernwong2021` เป็นการ์ดเดียวใน 62 ใบที่ไม่มี `doi:` เพราะ Crossref ไม่ได้ index วารสาร Chemical Engineering Transactions ที่มันตีพิมพ์ (ดู §4) เติม note อธิบายเหตุผลนี้ไว้ใต้ `## Notes` วันนี้ พอรัน `maw citation cards` รอบหน้าเพื่อ import JSONL ใหม่ note นั้นก็ยังอยู่ครบ ไม่ถูกลบทิ้ง — นี่คือสิ่งที่ทำให้การ์ดปลอดภัยกว่า generated table

**topic 6 ตัว = โครงสร้าง seed graph** นับตรงกับ 62 การ์ดพอดี:

| topic | papers |
|---|---:|
| satellite-pm25-products | 16 |
| low-cost-sensor-calibration | 14 |
| thailand-burning-season | 11 |
| health-policy | 9 |
| reference-monitoring-bam | 6 |
| multi-source-fusion-qa | 6 |

ทำไมต้อง markdown ไม่ทำ database ตอบสามข้อ

**Greppable** — `rg topic: ψ/papers/` เจอทันที ไม่ต้องเปิด client, ไม่ต้อง query language, ไม่ต้อง connection string เพราะไม่มี server ให้ connect อยากรู้ว่า topic ไหนมีกี่ใบ ก็ `rg -c "^topic:" ψ/papers/*.md` แล้วนับเอา ไม่ต้อง `SELECT COUNT(*) GROUP BY`

**Hand-editable** — เจอ error ในการ์ด แก้บรรทัดเดียวจบ (ดู §4 — 18 จุดที่แก้ไปจริงจาก audit) ไม่ต้อง migration script ไม่ต้อง ALTER TABLE `git diff` บนการ์ดหนึ่งใบก็เห็นเป็น text diff บรรทัดต่อบรรทัด ไม่ใช่ binary diff ของ database dump ที่อ่านไม่รู้เรื่อง แก้ author ผิดคน (เช่น li2022 ที่จริงคือ Jin, C.) ก็เปิดไฟล์เดียว แก้บรรทัดเดียว commit เดียว จบ

**Indexed ข้างๆ ความคิดตัวเอง** — `maw citation index --vault` embed ทั้งการ์ด paper และ `ψ/memory/{learnings,retrospectives,resonance}` กับ `ψ/writing/research` (ติด `kind: note`) ลงใน store เดียวกัน ค้นครั้งเดียวเจอทั้งสอง:

```
[0.7913] 📄 paper \cite{mahajan2025} (low-cost-sensor-calibration) Mahajan & Helbing (2025)
[0.8702] 📝 note (ψ/writing/research) Environmental prediction models for PM2.5
```

แถวบนเป็นวรรณกรรม แถวล่างเป็นความคิด oracle เอง ไฟล์เดียวกันในดิสก์ ค้นด้วยคำสั่งเดียวกัน — ไม่มี schema migration ระหว่าง "paper" กับ "note" เพราะทั้งคู่คือ markdown file ที่มี frontmatter แค่ต่าง `kind`

INDEX.md เป็นไฟล์ generated — สรุปเนื้อหาการ์ดทั้งหมด — **ห้ามแก้มือ** เพราะรันใหม่ทับหมด ตรงข้ามกับ `## Notes` ที่รันใหม่แล้วรอด นี่คือเส้นแบ่งที่ต้องจำ: ใต้ `## Notes` = ของ human/oracle เขียน รอดเสมอ, ไฟล์อื่นที่บอกว่า "generated" = ห้ามแตะ

Corpus จึงไม่ใช่ database ที่ต้อง backup แยก — มันคือ 62 ไฟล์ text ใน git repo เดียวกับโค้ด `git log` บนไฟล์ไหนก็เห็นประวัติการแก้ทุกจุด ลบ directory index ทิ้งก็สร้างใหม่ได้เพราะเป็น derived data (ดู §3) แต่การ์ดใน `ψ/papers/` ลบไม่ได้ — นั่นคือของจริงเพียงชุดเดียว
