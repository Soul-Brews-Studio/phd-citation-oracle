# บทที่ 4: โครงสร้าง — ของอยู่ไหน อะไรคือของจริง

`.bib` ผิด ค้นหาได้คำตอบมั่ว แก้ที่ไหน — คำตอบเดียว: แก้ที่การ์ดใน `ψ/papers/` เสมอ JSONL/store เป็นผลลัพธ์ derive ลบสร้างใหม่ได้ตลอด

## 4.1 แผนที่ repo

```bash
$ ls ψ
active/   inbox/    memory/   papers/
archive/  lab/      outbox/   writing/
learn/

$ ls artifacts
citation-audit.md      citation-network.svg
citation-network.html  citation.bib
citation-network.png   literature_corpus.jsonl

$ ls bin
citation

$ ls .claude/skills
gemini-deep-research/  research-harvest/
paper-card/            research-ingest/
```

| ที่ | เก็บอะไร |
|---|---|
| `ψ/papers/` | การ์ด paper 62 ใบ — **source of truth** |
| `ψ/lab/citation/` | โค้ด plugin (`src/index.ts`, `package.json`) |
| `artifacts/` | ผลผลิต — JSONL นำเข้า, `.bib`, กราฟ PNG/SVG/HTML |
| `bin/citation` | ทางเข้าแบบไม่ต้องมี maw |

`.claude/skills/` คนละชั้น — ใช้**หา**เนื้อหาใหม่ป้อนคอร์ปัส:

| skill | ทำอะไร |
|---|---|
| `gemini-deep-research` | เขียน brief/prompt ให้ tool นอกหาให้ |
| `research-ingest` | รับรายงานกลับ ตรวจ DOI กับ Crossref ก่อนสร้างการ์ด+index |
| `research-harvest` | แปลงรายงานที่ ingest แล้วเป็นตาราง/คิวตรวจ |
| `paper-card` | paper เดี่ยว (DOI/APA/BibTeX) เข้าการ์ดตรง ไม่ผ่าน pipeline |

### สองทางเข้า หนึ่ง implementation

handler เดียวกัน ไม่มี dispatch สองชุดให้ sync:

```bash
./bin/citation status      # ไม่มี maw ก็ใช้ได้ ต้องมีแค่ bun
maw citation status        # เหมือนกันทุกอย่าง สำหรับคนมี maw
```

ต่างกันแค่ตอน**หา repo root**:

| ลำดับ | แหล่ง | เงื่อนไข |
|---|---|---|
| 1 | `CITATION_ROOT` | ตั้ง env เอง ใช้ทันที |
| 2 | `MAW_HOME` | รันผ่าน maw |
| 3 | ตำแหน่ง**script** | ไล่ขึ้นหา `CLAUDE.md`+`ψ/` คู่กัน |
| 4 | **cwd** ปัจจุบัน | ไล่ขึ้นหาแบบเดียวกัน |
| 5 | `git rev-parse --show-toplevel` | อยู่ใน repo git |
| 6 | cwd ตรง ๆ | ทางสุดท้าย |

ข้อ 3 คือเหตุผลที่ `./bin/citation status` รันจาก `/tmp` ยังได้ผล (commit `051014b`) — ดูตำแหน่งสคริปต์ ไม่ใช่ที่เรายืน

รูตผิด `status` ไม่ error แค่รายงาน "0 paper card" เงียบ ๆ — บรรทัดแรกจึงบอกกฎเสมอ บนเครื่อง m5:

```
repo root: /opt/Code/github.com/Soul-Brews-Studio/
phd-citation-oracle (walk up from the script)
```

## 4.2 ψ/papers/ — การ์ดคือของจริง

62 การ์ด กฎเดียว: **ชื่อไฟล์ = citekey = คีย์ใน `\cite{}`** ไฟล์ `mahajan2025.md` มี `citekey: mahajan2025` วิทยานิพนธ์เขียน `\cite{mahajan2025}` ตรง ๆ ไม่มีชั้นแปลกลาง

README ของ `ψ/papers/`:

> "ที่นี่คือ source of truth ไม่ใช่ `artifacts/literature_corpus.jsonl` — JSONL เป็นแค่ช่องทาง import ตอนเริ่ม ถ้าจะแก้อะไรให้แก้ card"

import แล้ว JSONL หมดหน้าที่ แก้ทีหลังไม่มีผลกับการ์ด (เว้น `cards` regenerate — หัวข้อ 4.4)

62 การ์ดผูกกับ 1 ใน 6 taproot topic (field `topic`, หัวข้อ 4.3):

| topic | จำนวนการ์ด |
|---|---:|
| `satellite-pm25-products` | 16 |
| `low-cost-sensor-calibration` | 14 |
| `thailand-burning-season` | 11 |
| `health-policy` | 9 |
| `reference-monitoring-bam` | 6 |
| `multi-source-fusion-qa` | 6 |

รวม 62 พอดี — กราฟ `serve`/`graph` (บทที่ 5) ลงสีได้ 6 กลุ่ม

ใน `ψ/papers/` มีไฟล์ที่**ไม่ใช่**การ์ดสองไฟล์:

| ไฟล์ | คืออะไร | แก้มือได้ไหม |
|---|---|---|
| `<citekey>.md` | การ์ด — 1 ไฟล์ = 1 paper | ได้ นี่คือของจริง |
| `INDEX.md` | สารบัญ generate อัตโนมัติ | **ห้าม** — เดี๋ยวถูกทับ |
| `README.md` | คู่มือเพิ่ม/แก้การ์ดด้วยมือ | ได้ แต่ไม่ใช่ข้อมูล |

indexer ข้าม `INDEX.md`/`README.md` โดยเจตนา (เคยบั๊ก `README.md` หลุดเข้า index เป็น "uncategorized" — แก้แล้ว)

## 4.3 frontmatter 20 field

ทุกการ์ดขึ้นต้นด้วย YAML frontmatter ครบ 20 field ตัวอย่างจริง `mahajan2025.md`:

```yaml
citekey: mahajan2025
id: "2.1.4"
title: >-
  Dynamic calibration of low-cost PM2.5 sensors using
  trust-based consensus mechanisms
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
```

ไม่มี field 19-20 — เฉพาะการ์ดที่เคยถูก Crossref แก้ citekey/ผู้เขียน (หัวข้อ 4.6)

ตารางเต็มทั้ง 20 field — บังคับไหม embed เป็น vector ตอน `index` ด้วยไหม:

| # | field | คืออะไร | บังคับ | embed? |
|---|---|---|---|---|
| 1 | `citekey` | คีย์ citation ตรงชื่อไฟล์ | บังคับ | ไม่ |
| 2 | `id` | เลข section เรียง `INDEX.md` | บังคับ | ไม่ |
| 3 | `title` | ชื่อ paper เต็ม | บังคับ | ทางอ้อม |
| 4 | `short_title` | ชื่อสั้นบนกราฟ | แนะนำ | ใช่ |
| 5 | `authors` | รายชื่อผู้เขียน | บังคับ | ใช่ |
| 6 | `year` | ปีตีพิมพ์ | บังคับ | ใช่ |
| 7 | `journal` | ชื่อวารสาร | บังคับ | ไม่ |
| 8 | `quartile` | Q1–Q4 | บังคับ | ไม่ |
| 9 | `impact_factor` | IF วารสาร | บังคับ | ไม่ |
| 10 | `volume` | เล่มที่ | บังคับ | ไม่ |
| 11 | `issue` | ฉบับที่ | optional | ไม่ |
| 12 | `pages` | เลขหน้า | บังคับ | ไม่ |
| 13 | `doi` | DOI จาก Crossref | optional | ไม่ |
| 14 | `topic` | 1 ใน 6 topic เดิม | บังคับ | ไม่ |
| 15 | `status` | `ok` \| `needs-authors` | บังคับ | ไม่ |
| 16 | `verified` | แหล่งยืนยัน + วันที่ | optional | ไม่ |
| 17 | `tags` | `[paper, topic]` ใช้ filter | บังคับ | ไม่ |
| 18 | `kind` | `paper` — ห้ามลบ | บังคับ | ไม่ |
| 19 | `aka` | citekey เดิมก่อน rename | optional | ไม่ |
| 20 | `authors_upstream` | ผู้เขียนเดิมก่อนแก้ | optional | ไม่ |

แถว 3-6 "ทางอ้อม"/"ใช่" เพราะข้อความที่ยิงเข้า embedder ไม่ใช่ frontmatter ดิบ แต่เป็น**label**จาก `authors` ตัวแรก+`year`+`short_title` ต่อด้วย **Key findings**+**Thesis relevance** จาก body ถึง `## Notes`

journal/quartile/volume/pages/doi **ไม่ถูก embed** — ใช้ตอนออก `.bib`/โชว์ผลเท่านั้น ข้อความจริงที่ยิงเข้า `bge-m3` จากการ์ด `mahajan2025.md`:

```text
Mahajan & Helbing (2025) -- Trust-Based Dynamic Calibration

4-indicator trust framework (accuracy, stability,
responsiveness, consensus). MAE reductions up to 68% for
poor sensors, 35-38% for reliable ones.

HIGHEST CONCEPTUAL ALIGNMENT -- trust-scoring parallels
DustBoy's A-F confidence grading. Nature-family validation
of the confidence scoring concept.
```

`issue` เว้นว่างได้เงียบ ๆ (`jin2022` เว้นเพราะวารสารไม่มีเลขฉบับ) `doi` กรอกครบ **61/62** — เหลือ `jarernwong2021` ใบเดียว อยู่ *Chemical Engineering Transactions* ที่ Crossref ไม่มีข้อมูล (ไม่มั่นใจไม่เดา)

`topic` ไม่ถูก embed — ใช้ลงสี node บนกราฟ + gate ต้อง index ใหม่ (ต้องเป็น 1 ใน 6 topic) `kind: paper` ไม่มีผลความหมาย แต่ลบแล้ว index แยก paper จาก vault note ไม่ได้

## 4.4 ## Notes ไม่หาย — อะไรรอดเวลา regenerate

body ของทุกการ์ดมีสามก้อนตายตัว ตามด้วย `## Notes`:

```markdown
**Key findings** — เจออะไร ใส่เลขจริงให้ครบ
**Thesis relevance** — เกี่ยวกับงานเรายังไง
**Full citation** — reference เต็มแบบ APA

## Notes

โน้ตของเราเอง
```

parser จับสามก้อนด้วย pattern `**label** —` ตรง ๆ เว้นวรรค/สลับ format นิดเดียวจับไม่เจอ ต้องคงรูปแบบเวลาแก้มือ

จุดอันตราย — parser **ไม่ error ตอนจับไม่เจอ** คืนสตริงว่างเฉย ๆ พิมพ์ `**Key Finding**` (s หาย) หรือลืม `—` → ส่วนนั้นว่างตอน embed แต่ `index` ผ่านปกติ search หาไม่เจอ — บั๊กเงียบแบบเดียวกับ NUL byte บทที่แล้ว

`cards` regenerate การ์ดทั้งชุดจาก JSONL ใช้ตอนอัปเดต/import เพิ่ม — ทับงานแก้มือได้ถ้าไม่ระวัง อะไร**รอดเสมอ** กับอะไร**รอดเพิ่ม**เมื่อมี `verified:`:

| รอดเสมอ ไม่ว่าอะไร | รอดเพิ่ม ถ้ามี `verified:` |
|---|---|
| ทุกอย่างใต้ `## Notes` | `authors` |
| `doi:` ที่เคยเติมไว้ | `title` |
| `aka:` | `journal` |
| `authors_upstream:` | `volume` |
| | `issue` |
| | `pages` |

เหตุผล — JSONL ต้นทางผิดตั้งแต่แรก (หัวข้อ 4.6) ปล่อย `cards` ทับ field พวกนี้ทุกครั้งเท่ากับ**revert งาน verify ทิ้งหมด** — มี `verified:` แปลว่า "ห้ามแตะ field พวกนี้แล้ว"

field อื่นนอกสองคอลัมน์นี้ (`id` `short_title` `quartile` `impact_factor` `topic` `status` `tags` `kind` + body สามก้อนแรก) ถูกทับด้วย JSONL ทุกครั้งถ้ายังไม่ verified แก้ถาวรต้องแก้ที่ JSONL เอง หรือเลิกใช้ `cards`

## 4.5 store — ไฟล์ธรรมดา 3 ไฟล์ ไม่มี database

`index` เอาการ์ดไป embed แล้วเก็บผลที่ store — ไม่ใช้ database ใช้ไฟล์ธรรมดาสามไฟล์:

| ไฟล์ | เก็บอะไร |
|---|---|
| `vectors.f32` | Float32 เรียงต่อกัน N × 1024 มิติ |
| `meta.jsonl` | 1 บรรทัด = 1 แถว (id/kind/citekey/title/topic) |
| `manifest.json` | `{ model, dim, count, updated }` |

standalone store บนเครื่อง m5 อยู่ที่ `<repo>/.citation/store` — `manifest.json` จริง:

```json
{
  "model": "ollama:bge-m3",
  "dim": 1024,
  "count": 75,
  "updated": "2026-07-25T11:30:39.102Z"
}
```

75 แถว = 62 paper + 13 vault note (index ด้วย `--vault`) หนักประมาณ 300 KB — เบากว่าไฟล์รูปหนึ่งใบ

`manifest.json` จำชื่อ model เพราะ vector จาก model ต่างกัน**เทียบกันไม่ได้** — 1024 มิติจาก `bge-m3` ไม่อยู่พื้นที่เดียวกับ model อื่น สลับ model ต้อง `index` ใหม่ทั้งชุด แปลงทีละแถวไม่ได้

ผ่าน maw ย้ายไปเก็บที่ `$MAW_HOME/citation-data/store` แทน รูปแบบไฟล์เหมือนเดิม ทั้งคู่ gitignore ลบทิ้งได้ตลอด `index --vault` สร้างใหม่ได้เพราะเป็น derived data ล้วน ๆ

search brute-force cosine ล้วน ๆ ไม่มี ANN index — 75 แถวใช้เวลาประมาณ **0.2 วินาที** รวม embed คำค้น ยังไม่ต้องคิด scale จนกว่า corpus จะโตหลักหมื่นแถว

## 4.6 aka: กับ authors_upstream: — ทำไมไม่มีอะไรถูกลบ

รัน `citation doi` ครั้งแรกถาม Crossref หา DOI ให้ครบ เจอว่า corpus ต้นทางผิด **18 จุด ใน 14 การ์ด** บางใบผิดหนักถึงใส่ผู้เขียนคนแรกผิดคนไปเลย

ตัวอย่างจริง — `jin2022.md` เดิมชื่อไฟล์ `li2022.md` ใส่ผู้เขียนเป็น Li, R./Hu, Y./Li, H./Zhang, Y. แต่ Crossref ยืนยันผู้เขียนจริงคือ Jin, C. — rename `li2022` → `jin2022` ของเดิมไม่หายไปไหน การ์ดใบเดียวกันเก็บสองเวอร์ชันไว้:

```yaml
citekey: jin2022
aka: li2022
authors_upstream:
  - "Li, R."
  - "Hu, Y."
  - "Li, H."
  - "Zhang, Y."
```

`aka:` เก็บ citekey เดิมก่อน rename `authors_upstream:` เก็บรายชื่อที่ JSONL เคยอ้างผิด — mechanism สองชั้นของ **Nothing is Deleted**:

- **ชั้นแรก** กัน**การ์ดผี** — `cards` regenerate อ่าน `aka:` รู้ว่า `li2022` rename เป็น `jin2022` แล้ว ไม่สร้าง `li2022.md` ซ้ำ ไม่มี `aka:` ทุกรอบ regenerate จะได้การ์ดผีใหม่โผล่เรื่อย ๆ
- **ชั้นสอง** เก็บ**หลักฐานความผิดพลาด** — ไม่ใช่ลบของผิดแล้วเขียนทับเงียบ ๆ `authors_upstream` บอกว่า "เคยเชื่อว่าคือคนนี้" `authors:` บอกว่า "จริง ๆ คือคนนี้" อยู่ไฟล์เดียวกัน

รายการเต็ม 18 จุด แยกประเภท (ผู้เขียนผิดคน 7 · title แต่งขึ้น 1 · เลขหน้าผีจากเลขท้าย DOI 7 · journal ผิด 1 · volume สลับเลขหน้า 2) อยู่ที่ `artifacts/citation-audit.md`

`aka:`/`authors_upstream:` **ไม่คุ้มครองทุกการแก้** — เฉพาะ citekey เปลี่ยนหรือรายชื่อผู้เขียนเปลี่ยน สองตัวอย่างสวนทาง:

| การ์ด | เกิดอะไร | มี `aka:`? | มี `authors_upstream:`? |
|---|---|---|---|
| `she2019` | JSONL แต่ง title เอง (DOI ถูก) Crossref แก้ title citekey ไม่เปลี่ยน | ไม่มี | ไม่มี |
| `yu2023` | เดิมชื่อไฟล์ `npjclimate2023` แก้เป็น `yu2023` ผู้เขียนไม่เคยผิด ผิดแค่เลขหน้า (363 จากท้าย DOI แทนที่ 41) | มี | ไม่มี |

`she2019` ร่องรอย title เดิมอยู่ที่ `citation-audit.md` กับ git history เท่านั้น ไม่อยู่ในไฟล์การ์ด

สรุป — `aka:` ตามการเปลี่ยน**ชื่อไฟล์** `authors_upstream:` ตามการเปลี่ยน**เนื้อหา authors** อิสระจากกัน field อื่น (title, pages, journal, volume) ไม่มี field รองรับ ต้องพึ่ง `citation-audit.md` กับ `git log` — "Nothing is Deleted" ไม่ได้แปลว่าฟิลด์เดียวเก็บทุกอย่าง แปลว่า**มีที่เก็บอยู่เสมอ** คนละชั้นตามแต่อะไรเปลี่ยน

บทที่ 5 เรียงคำสั่งทั้ง 8 ตัวตามลำดับใช้จริง เริ่มจาก `status` — โครงสร้างบทนี้คือสิ่งที่ `status` รายงานให้ฟังทุกครั้งที่เรียก
