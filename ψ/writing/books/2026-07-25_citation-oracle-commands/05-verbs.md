# บทที่ 5: วิธีการใช้งาน — 8 คำสั่ง เรียงตามลำดับที่ใช้จริง

8 คำสั่ง เรียงตามงานจริง ไม่ใช่ A-Z อธิบายสั้น + คำสั่งจริง +
output จริง

| ลำดับ | คำสั่ง | ทำอะไร |
|---|---|---|
| 1 | `status` | เช็คทุกชิ้นส่วนพร้อมไหม — รันก่อนเสมอ |
| 2 | `cards` | JSONL → การ์ด markdown 1 ใบ/paper |
| 3 | `doi` | ถาม Crossref หา DOI + ผู้แต่ง |
| 4 | `bib` | การ์ด → `.bib` ใช้ใน LaTeX |
| 5 | `index` | embed การ์ดเข้า vector store |
| 6 | `search` | ค้นความหมาย ไม่ใช่ค้นคำ |
| 7 | `serve` | แผนที่ดาวแบบ interactive |
| 8 | `graph` | แผนที่ดาวเป็น PNG/SVG |

7-8 เป็นคู่ ข้อมูลชุดเดียวกัน — `serve` ลาก-ซูมสด `graph`
เป็นไฟล์นิ่ง

## 5.1 `status` — รันก่อนเสมอ ไม่มี flag ให้จำ

```bash
./bin/citation status
```

```
── citation status ──
  ✓ repo root: .../phd-citation-oracle (walk up from script)
  ✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
  ✓ corpus present (artifacts/literature_corpus.jsonl)
      — 23814 bytes
  ✓ store ready — 62 paper(s) + 13 vault note(s) · 1024-dim
      · 300 KB · model ollama:bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified
  ✓ embeddings: ollama bge-m3 @ localhost:11434 — no egress
      └ bge-m3:latest · 634 MB · 100% GPU · 8192 ctx
  ✓ arra-oracle-v3 reachable (localhost:47778) — ok [optional]
```

`status` คือประตูของ 7 คำสั่งที่เหลือ — พังจุดนี้ คำสั่งถัดไป
พังเงียบๆ ไม่มี error

## 5.2 `cards` — JSONL → การ์ด (idempotent)

```bash
./bin/citation cards
```

```
✦ 56 paper card(s) → .../ψ/papers
  created 0 · updated 56 · notes preserved on 2
  upstream citations matched: 56/56
  index: .../ψ/papers/INDEX.md

Next: maw citation index   (cards are picked up automatically)
```

| ตัวเลข | ที่มา |
|---|---|
| 56 | นับจาก corpus JSONL อย่างเดียว |
| 62 | ของจริงใน `ψ/papers/` — อีก 6 มาจาก research ingest |

`cards` แตะแค่ 56 ใบจาก JSONL อีก 6 ปล่อยเฉย `INDEX.md` นับ
ไดเรกทอรีจริง ได้ 62 เสมอ

`Next:` พิมพ์ `maw citation index` คงที่ในโค้ด แม้เรียกผ่าน
`./bin/citation` — แนะนำเฉยๆ ไม่ใช่บั๊ก

รันซ้ำได้ — `git diff` ไม่เปลี่ยนแม้แต่ไบต์เดียว ไม่มี timestamp
ฝังใน frontmatter

flag เดียว — ระบุ path `.jsonl` อื่นแทน default:
`./bin/citation cards path/to/other.jsonl` (แทบไม่ใช้ เพราะ
corpus มีไฟล์เดียว)

## 5.3 `doi` — ถาม Crossref (dry run เป็น default)

**default คือ dry run** ไม่เขียนจนสั่ง `--write` — Crossref เดา
ผิดได้ ดูก่อนเชื่อดีกว่าเขียนทับแล้วแก้

```bash
./bin/citation doi jarernwong2021
```

```
✦ resolving 1 of 62 card(s) against Crossref
  [dry run — pass --write to save]

  ? jarernwong2021 — no confident match
    (best title similarity only 0.76)
      best: [0.76] journal-article 10.3390/atmos14020261
      Health Impact Related to Ambient Particulate...

  resolved 0 · ambiguous 1 · failed 0
```

0.76 ต่ำกว่าเกณฑ์ 0.85 — ปล่อยว่างดีกว่าผูก DOI ผิด ใบเดียวใน 62
ที่ยังไม่มี DOI (ตีพิมพ์ใน Chemical Engineering Transactions ที่
Crossref ไม่ครอบคลุม)

default คือทุกใบที่ DOI/ผู้แต่งไม่ครบ ไม่ใช่ทั้ง 62 ใบ

| flag | ทำอะไร |
|---|---|
| `--write` | เขียนผลจริงลงการ์ด (ไม่ใส่ = dry run) |
| `--all` | เช็คซ้ำทุกใบ แม้มี DOI แล้ว |
| `--rekey` | เปลี่ยนชื่อไฟล์เป็นชื่อจริง (คีย์เก่าเก็บใน `aka:`) |

รันจริงทั้งคลัง — DOI จาก 8/62 → 61/62 เจอ error 18 จุดใน 14
การ์ด ส่วนใหญ่วารสาร/หน้า/ผู้แต่งคนแรกผิด (Crossref เชื่อได้กว่า
JSONL ต้นทาง) รายละเอียดที่ `artifacts/citation-audit.md`

## 5.4 `bib` — การ์ด → `artifacts/citation.bib`

```bash
./bin/citation bib
```

```
✦ 62 citable entries → .../artifacts/citation.bib
  61/62 carry a DOI · 1 without

Use in LaTeX:  \bibliography{artifacts/citation}
  then \cite{adong2025}
```

"citable" ≠ มี DOI — แปลว่าผู้แต่ง/ชื่อเรื่อง/วารสาร/ปีครบ การ์ด
ที่ขาดผู้แต่ง**คอมเมนต์ไว้ ไม่ตัดทิ้ง** — `withheld` บอกว่าขาด
อะไร แก้ด้วย `citation doi --write` แล้วรัน `bib` ใหม่

flag เดียว — `--by-topic` จัดกลุ่มตาม 6 หัวข้อแทน citekey ช่วย
เขียน related work ทีละหัวข้อ

ตรวจผ่าน `bibtex` จาก TeX Live 2026 — 62 entry เข้า 62
`\bibitem` เป๊ะ warning 0

## 5.5 `index` / `search` — `--vault` รวม paper กับ note

`index` แปลงข้อความการ์ดเป็นเวกเตอร์ 1024 มิติผ่าน ollama ทำหลัง
`cards` เสร็จ ทำซ้ำเมื่อแก้ title/summary/relevance (`doi:`
ไม่ต้อง — ไม่ถูก embed)

```bash
./bin/citation index --vault
```

```
Loaded 62 paper card(s) from .../ψ/papers
Loaded 13 vault note(s) from ψ/memory/learnings,
  ψ/memory/retrospectives, ψ/memory/resonance,
  ψ/writing/research
Embedded 75 item(s) in batches of 16
Wrote .../.maw/citation-data/store — 75 × 1024-dim
  (300 KB), model ollama:bge-m3

✓ indexed 62 paper(s) across 6 topic(s):
      9  health-policy
     14  low-cost-sensor-calibration
      6  multi-source-fusion-qa
      6  reference-monitoring-bam
     16  satellite-pm25-products
     11  thailand-burning-season
✓ indexed 13 vault note(s) alongside them (searchable
  together)
```

path ของ store แล้วแต่ shell session — มี `MAW_HOME` ได้
`.maw/citation-data/store` ไม่มีได้ `<repo>/.citation/store`
แทน — เชื่อ `status` เสมอว่า store อยู่ไหน

`--vault` = flag ใช้บ่อยสุด — ไม่ใส่ได้แค่ 62 paper ใส่แล้ว
ครอบคลุมโน้ตวอลต์ด้วย (retro, learning, research draft)

store ไม่ใช่ database — ไฟล์ธรรมดา 3 ไฟล์ (`vectors.f32`
`meta.jsonl` `manifest.json`) เปลี่ยน model ต้อง `index` ใหม่
ทั้งชุดเสมอ เวกเตอร์คนละ model เทียบกันไม่ได้

```bash
./bin/citation search "low-cost sensor calibration PM2.5" -k 3
```

```
Top 3 result(s) for "low-cost sensor calibration PM2.5...":

  [0.6481] 📄 paper \cite{bulot2023}
  (low-cost-sensor-calibration) Bulot (2023) --
  Reference-Grade from Low-Cost Sensors

  [0.6287] 📝 note (ψ/writing/research) Environmental
  prediction models for PM2.5...

  [0.5771] 📄 paper \cite{scientificreports2025}
  (low-cost-sensor-calibration) ML Mixed Correction
```

อันดับสองไม่ใช่ paper — เป็นโน้ตของเราเอง (📝) ผลจาก `--vault`
ไม่ต้องแยกค้นสองรอบ

flag ใช้บ่อย — `-k N` กำหนดจำนวนผล (default 5), `--json` ต่อ
pipe สคริปต์อื่น

```bash
./bin/citation search "burning season northern Thailand" \
  -k 1 --json
```

```json
[
  {
    "similarity": 0.5625,
    "kind": "paper",
    "citekey": "wongnakae2023",
    "title": "Wongnakae et al. (2023) -- RF PM2.5...",
    "topic": "thailand-burning-season",
    "path": "ψ/papers/wongnakae2023.md"
  }
]
```

ไม่มี database ไม่มี ANN index — brute-force cosine ล้วนๆ 75
แถวใช้เวลาราว 0.2 วินาที ข้อมูลแค่หลักสิบ ยังไม่ต้องซับซ้อนกว่านี้

## 5.6 `serve` / `graph` — ดูกลุ่มดาว

ทั้งคู่คำนวณ cosine similarity ระหว่างทุกคู่ paper วาดเป็น
เส้นเชื่อม — คือ "ใกล้เคียงเชิงความหมาย" ไม่ใช่ "ใครอ้างอิงใคร"

`serve` (หรือ `visualize`) เปิด server localhost แบบ interactive
ลาก ซูม hover ดู default port 5556 ชนพอร์ตเดิม — ขยับเอง
อัตโนมัติ ไม่ล้มด้วย `EADDRINUSE`

```bash
./bin/citation serve --port 5570
```

```
✦ citation constellation (2D) — http://localhost:5570
62 papers · 6 topics · 71 edges (sim > 0.68)
drag to pan · scroll to zoom · click a star for detail

── verbose ──
  layout       t-SNE (PCA-init, deterministic) in 360 ms
  similarity   max 0.819 · mean 0.541 over 1891 pairs
  edges        71 of 1891 pairs above 0.68 (3.8%)
  isolated     15 paper(s) with no edge at this threshold
  most-connected
        8  Nakapan & Hongthong (2022)
        6  Buya et al. (2023)
        6  Choi et al. (2019)
```

"isolated 15" ไม่ใช่บั๊ก — 15 ใบไม่มีเส้นเชื่อมที่ threshold 0.68
แค่ห่างจากใบอื่น ลด threshold ถึงเห็นเส้นบางๆ

`graph` render ผลเดียวกันเป็นไฟล์นิ่ง — SVG/PNG แนบเอกสารได้ตรง
ไม่ต้องมี server ค้าง

```bash
./bin/citation graph
```

```
✦ citation graph → .../artifacts/citation-network.svg
✦ png            → .../artifacts/citation-network.png
62 papers · 6 topics · 1336 edges (cosine > 0.5, max 0.817)
dense — raise threshold for a cleaner graph:
maw citation graph --threshold 0.60
```

threshold default ของ `graph` (0.5) ต่ำกว่า `serve` (0.68) โดย
ตั้งใจ — ได้ 1336 เส้นทันที เครื่องมือเตือน "dense" พร้อมบอกเลข
ที่ควรลอง

| flag | ใช้กับ | ทำอะไร |
|---|---|---|
| `--threshold N` | ทั้งคู่ | ปรับความเข้มเส้น (สูง = น้อยแต่มั่นใจกว่า) |
| `--quiet` | `serve` | ตัด verbose เหลือแค่ banner + URL |
| `--html` | `graph` | export หน้า interactive เป็น `.html` ไม่ต้องรัน server |

PNG ต้องมี `sharp` — optional dependency ตัวเดียวในทั้ง repo
ไม่มีก็ไม่พัง ได้แค่ SVG พร้อมข้อความ `(png skipped — 'sharp'
not installed; the SVG above is the figure)` คมกว่า PNG อยู่แล้ว
ในฐานะ vector image

## 5.7 ลำดับที่ใช้จริงตอนเริ่มจากศูนย์

Copy ทั้งก้อนไปรันได้เลย ไม่ต้องแก้ (`ollama pull` ตามความเร็ว
เน็ต ที่เหลือเป็นวินาที)

```bash
git clone \
  https://github.com/Soul-Brews-Studio/phd-citation-oracle
cd phd-citation-oracle

# 1) ต้องมีตัวเดียว — เช็คก่อน
bun --version

# 2) ควรมี — ข้ามได้ถ้าแค่จะทำ .bib อย่างเดียว
brew install ollama
ollama pull bge-m3

# 3) เช็คทุกชิ้นส่วนในทีเดียว
./bin/citation status

# 4) JSONL → การ์ด (idempotent รันซ้ำได้เสมอ)
./bin/citation cards

# 5) ดูก่อนว่า Crossref จะแก้อะไร (dry run)
./bin/citation doi
# พอใจผลแล้วค่อยเขียนจริง + เปลี่ยนคีย์ placeholder
./bin/citation doi --write --rekey

# 6) การ์ด → .bib
./bin/citation bib

# 7) embed เข้า store (--vault พ่วง vault notes ด้วย)
./bin/citation index --vault

# 8) ลองค้นดูสักคำ
./bin/citation search "PM2.5 satellite AOD Thailand"

# 9) ดูแผนที่ดาว — เลือกแบบไฟล์นิ่งหรือแบบ interactive
./bin/citation graph
./bin/citation serve
```

9 ขั้นตอน 8 คำสั่ง (`doi` ปรากฏสองครั้ง — dry run ก่อน ค่อย
`--write`) จากศูนย์ถึงมี `.bib` พร้อมส่งวิทยานิพนธ์ กับแผนที่ดาว
ให้มอง ใช้เวลาไม่ถึง 5 นาทีบนเครื่องที่มี ollama รันอยู่แล้ว
