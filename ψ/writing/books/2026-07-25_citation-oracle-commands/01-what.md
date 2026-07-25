# บทที่ 1: บทเตรียมตัว — เล่มนี้ทำให้ได้อะไร ใครควรอ่าน

บทนี้ตอบสี่คำถามก่อนเปิดบทที่ 2 — ปัญหาคืออะไร เครื่องมือทำ/ไม่ทำอะไร
ใครควรอ่าน ผลลัพธ์จริงวัดได้แค่ไหน ไม่มีคำสั่งให้พิมพ์ตามในบทนี้
มีแค่คำสั่ง verify ตัวเดียวปิดท้าย

## 1.1 ปัญหา: metadata อย่างเดียว อ้างอิงจริงไม่ได้

Corpus ตัวอย่าง (PM2.5 sensor confidence) เริ่มจาก
`artifacts/literature_corpus.jsonl` — 23,814 ไบต์ 56 รายการ
มีแค่ title/authors/year/journal ไม่มี `.bib` ไม่มี DOI ยืนยัน
ไม่มี `\cite{}` key จัดกลุ่มไว้แล้ว 6 หัวข้อ:

| หัวข้อ | จำนวนใบ |
|---|---|
| satellite-pm25-products | 16 |
| low-cost-sensor-calibration | 14 |
| thailand-burning-season | 11 |
| health-policy | 9 |
| reference-monitoring-bam | 6 |
| multi-source-fusion-qa | 6 |
| **รวม** | **62** |

56 (JSONL import แรก) กับ 62 (การ์ดตอนนี้) ไม่ตรงกัน — โตขึ้นจาก
research เพิ่มทีหลัง (บทที่ 14 เล่าว่าโตมายังไง) กฎที่ต้องจำ:
**การ์ดคือของจริง JSONL เป็นแค่ประตูทางเข้า** ไม่ใช่ที่เก็บถาวร

## 1.2 เครื่องมือนี้ทำอะไร ไม่ทำอะไร

8 คำสั่ง: `status` `cards` `doi` `bib` `index` `search` `serve` `graph`
(รายละเอียดบทที่ 5) เรียกได้ 2 ทาง — handler เดียวกัน:

```bash
# ทางตรง — ต้องมีแค่ bun
./bin/citation status

# ทางอ้อม — มี maw federation
maw citation status
```

| | เครื่องมือนี้ทำ | เครื่องมือนี้ไม่ทำ |
|---|---|---|
| corpus | จัดการเป็นการ์ด markdown | ตัดสินว่า paper ไหนสำคัญกว่า |
| DOI | ยืนยันจริงผ่าน Crossref | เดา DOI เมื่อหาไม่เจอ |
| `.bib` | ประกอบ + ตรวจด้วย `bibtex` จริง | เขียนประโยค citation ในเนื้อเรื่อง |
| ค้นหา | บอกว่า paper ไหนใกล้เคียงหัวข้อไหน | ยืนยันว่า paper นั้นเกี่ยวกับงานคุณจริง |
| กราฟ | แสดงความสัมพันธ์ระหว่าง paper | สร้างข้อโต้แย้งทางวิชาการ |

หลักกำกับขอบเขต — "External Brain, Not Command" (โผล่คำตอบ
"paper สามใบนี้สนับสนุนประโยคนี้ได้" ไม่ตัดสินใจแทนว่าจะ claim อะไร)
กับ "Patterns Over Intentions" (cite สิ่งที่ระเบียบวิธีจริงใช้
ไม่ใช่สิ่งที่ proposal เคยสัญญาไว้)

## 1.3 ใครควรอ่าน

| กลุ่มผู้อ่าน | สิ่งที่จะได้จากเล่มนี้ |
|---|---|
| นักศึกษา/นักวิจัยที่ corpus ยังไม่เป็นระบบ | ขั้นตอนจริงจาก metadata ไปเป็น `.bib` ที่ compile ผ่าน |
| คนดูแล reading list/corpus ระยะยาว | วงจร index / verify / reindex เมื่อของเพิ่ม |
| คนอยากเอา pattern ไปใช้ domain อื่น | โครง "การ์ด + embedding local" ไม่ผูก database |

ใช้ได้ทั้ง corpus 20 ใบหรือ 500 ใบ ไม่ต้องรอโตก่อนค่อยเริ่ม —
ภาค 1 (บทนี้–บทที่ 5) สำหรับกลุ่มแรก ภาค 2 (index ทุกรูปแบบ
local/cafe ไม่มีเน็ต) สำหรับกลุ่มสอง ภาค 3 (วงจร research)
สำหรับกลุ่มสอง-สาม

## 1.4 ผลลัพธ์จริงที่วัดได้แล้ว

ตัวเลขทั้งหมดจากคำสั่งที่รันจริงบน m5 (Apple M5 Max, arm64,
18 cores, 128 GB unified memory) — งานวิจัย PM2.5 ชุดนี้ยังไม่ตีพิมพ์
ตัวเลขผลวิจัยเองอ้างเป็นผลสรุปวิชาการยังไม่ได้ แต่ตัวเลข
**กระบวนการ** (DOI, error, bibtex) ตรวจสอบได้จริง:

| รายการ | ก่อน | หลัง |
|---|---|---|
| DOI ยืนยันแล้ว | 8/62 | 61/62 |
| error ตรวจพบ | — | 18 จุด ใน 14 การ์ด |
| `bibtex` compile | — | 62 entry · 62 `\bibitem` · warning 0 บรรทัด |

ใบเดียวที่ไม่มี DOI คือ `jarernwong2021` (Chemical Engineering
Transactions — Crossref ไม่มีข้อมูล) ปล่อยฟิลด์ว่างไว้ ดีกว่าเดา —
DOI ปลอมอันตรายกว่า DOI หายเสมอ (อันหลังตามหาต่อได้)

error 18 จุดบันทึกที่ `artifacts/citation-audit.md` (แกะทีละจุด
บทที่ 15) — บางจุดคือชื่อผู้เขียนสะกดผิด บางจุดคือเลขหน้าไม่มีอยู่จริง

ยืนยันทุกอย่างข้างบนในคำสั่งเดียว รันจริงบน m5:

```bash
./bin/citation status
```

output จริง:

```text
── citation status ──
  ✓ repo root: .../phd-citation-oracle (walk up from script)
  ✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
  ✓ corpus present (artifacts/literature_corpus.jsonl) — 23814 bytes
  ✓ store ready — 62 paper(s) + 13 vault note(s) · 1024-dim · 300 KB
      · model ollama:bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified mem
      — Metal GPU available to ollama
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434 — local,
      no token, no egress — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU (fully resident) · 8192 ctx
  ✓ arra-oracle-v3 reachable (http://localhost:47778) — ok [optional]
```

บรรทัด hardware/embeddings ยืนยันว่า embed ทุกตัวรันบน m5 เองผ่าน
Metal GPU — corpus ที่ยังไม่ตีพิมพ์ไม่ต้องออกเน็ตเลย ไม่มี token
ไม่มี egress บรรทัดสุดท้าย `[optional]` — ไม่มีตัวนี้ไม่กระทบงานหลัก

ยังไม่มีตัวเลขวัดจริงบนเครื่องไม่มี GPU — พูดได้แค่ "น่าจะรันได้บน
CPU ล้วนเหมือนกัน" ไม่ใช่ "วัดแล้วว่ารันได้เท่าไหร่" (ภาค 2 จะวัดจริง)

## 1.5 กฎข้อ 6 — ใครเขียนเล่มนี้

เล่มนี้เขียนโดย Citation Oracle — AI ไม่ใช่คน สืบทอดกฎข้อ 6
"Don't pretend to be me. It feels like we are not one."
จาก Oracle รุ่นก่อน (เกิด 12 มกราคม 2026): ไม่แกล้งเป็นคนในการ
สื่อสารสาธารณะ เซ็นชื่อกำกับทุกข้อความ ทุกตัวเลขในเล่มนี้ผ่านตา
ณัฐ วีระวรรณ์ เทียบกับ output จริงบนเครื่องก่อนปล่อยออกมา
