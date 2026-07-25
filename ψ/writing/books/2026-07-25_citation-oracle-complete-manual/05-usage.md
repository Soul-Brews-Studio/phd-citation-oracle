# บทที่ 5: วิธีการใช้งาน — 8 คำสั่ง เรียงตามลำดับที่ใช้จริง

บทที่ 2 บอกชื่อทั้ง 8 คำสั่งไปแล้วครั้งหนึ่ง — `status` `cards`
`doi` `bib` `index` `search` `serve` และ `graph` — พร้อมสัญญาไว้ว่า
"เล่าเต็มในบทที่ 5" นี่คือบทนั้น

แต่เรียงยังไงล่ะ ตัวอักษร A-Z คงไม่ใช่ เพราะถ้าเรียงตามนั้น `bib`
จะมาก่อน `cards` ทั้งที่ยังไม่มีการ์ดสักใบให้แปลงเป็น BibTeX เลย —
บทนี้เรียงตาม**งานจริง** ที่คำสั่งก่อนหน้าต้องเสร็จก่อน คำสั่งถัดไป
ถึงจะมีอะไรให้ทำ

| ลำดับ | คำสั่ง | ทำอะไร |
|---|---|---|
| 1 | `status` | เช็คว่าทุกชิ้นส่วนพร้อมไหม — รันก่อนเสมอ |
| 2 | `cards` | JSONL → การ์ด markdown 1 ใบ/paper |
| 3 | `doi` | ถาม Crossref หา DOI + ผู้แต่งจริง |
| 4 | `bib` | การ์ด → `.bib` พร้อมใช้ใน LaTeX |
| 5 | `index` | embed การ์ดเข้า vector store |
| 6 | `search` | ค้นความหมาย ไม่ใช่ค้นคำ |
| 7 | `serve` | เปิดแผนที่ดาวแบบ interactive |
| 8 | `graph` | render แผนที่ดาวเป็น PNG/SVG |

7 กับ 8 จริงๆ แล้วเป็นคู่ ทำงานบนข้อมูลชุดเดียวกัน — ต่างกันแค่
`serve` เปิด server ให้ลาก-ซูมสด ส่วน `graph` render ออกมาเป็นไฟล์
นิ่งที่แนบในวิทยานิพนธ์ได้ตรงๆ

แต่ละคำสั่งด้านล่างมี output จริง 1 ก้อนที่รันจากเครื่อง m5 ตอน
เขียนบทนี้ พร้อม flag ที่ใช้บ่อยที่สุดเท่านั้น — ไม่ยัด flag ทั้งหมด
ที่มี เพราะบางตัวเป็น edge case ที่นานๆ ครั้งถึงจะได้แตะสักที

## 5.1 `status` — คำสั่งที่อธิบายตัวเอง

บทที่ 2 ผ่าทุกบรรทัดของ `status` ไปละเอียดแล้ว บทนี้ไม่พูดซ้ำ
เอาแค่ประเด็นที่เกี่ยวกับ "ใช้งานยังไง" — รันก่อนทุกครั้งที่เปิดงาน
ใหม่ ไม่ต้องมี flag อะไรทั้งนั้น ไม่มีอะไรให้จำ

```bash
./bin/citation status
```

```
── citation status ──
  ✓ repo root: /opt/Code/github.com/Soul-Brews-Studio/phd-citation-oracle (walk up from the script)
  ✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
  ✓ corpus present (artifacts/literature_corpus.jsonl) — 23814 bytes
  ✓ store ready (…/.citation/store) — 62 paper(s) + 13 vault note(s) · 1024-dim · 300 KB · model ollama:bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified memory — Metal GPU available to ollama
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434 — local, no token, no egress — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU (fully resident — no CPU fallback) · 8192 ctx
  ✓ arra-oracle-v3 reachable (http://localhost:47778) — ok [optional]
```

เหตุผลที่บทนี้ยังยกบล็อกเดิมมาแปะซ้ำ — เพราะ `status` ไม่ใช่แค่
"คำสั่งลำดับที่ 1 ในตาราง" มันคือ**ประตูของทุกคำสั่งที่เหลือ** การ์ด
0 ใบ ถามหา DOI ไม่ได้ ทำ `.bib` ไม่ได้ ล้วนสืบมาจากบรรทัดแรกของ
`status` ทั้งนั้น — ผิดตรงนั้นจุดเดียว เจ็ดคำสั่งที่เหลือพังตามกันหมด
เงียบๆ โดยไม่มี error ให้เห็นเลยสักตัว

## 5.2 `cards` — JSONL → การ์ด (idempotent)

รอบแรกที่ clone repo มา `ψ/papers/` ยังว่างเปล่า มีแต่
`artifacts/literature_corpus.jsonl` ที่เป็น metadata ดิบ — `cards`
คือคำสั่งที่แปลงมันเป็นการ์ด markdown ทีละใบ พร้อมสร้าง
`INDEX.md` สรุปตามหัวข้อให้

```bash
./bin/citation cards
```

```
✦ 56 paper card(s) → …/ψ/papers
  created 0 · updated 56 · notes preserved on 2
  upstream citations matched: 56/56
  index: …/ψ/papers/INDEX.md

Next: maw citation index   (cards are picked up automatically)
```

ตัวเลข 56 ในบล็อกนี้มาจาก corpus JSONL ล้วนๆ — แต่ `ψ/papers/`
จริงมี 62 ใบ เพราะอีก 6 ใบมาจาก research ingest ทีหลัง ไม่ได้
ผ่านทาง JSONL เลยสักใบ `cards` แตะแค่ 56 ใบที่มันรู้จัก ส่วนอีก 6
ปล่อยเฉยไว้ตามเดิม ไม่ทับ ไม่ลบ — `INDEX.md` ที่สร้างขึ้นถึงนับได้
ครบ 62 เสมอ เพราะมันอ่านจากไดเรกทอรีจริง ไม่ใช่จากรอบ import
ครั้งนี้ครั้งเดียว

(สังเกตบรรทัดสุดท้ายที่ขึ้นต้นด้วย `Next:` — มันพิมพ์ `maw citation
index` เสมอ ต่อให้เรียกผ่าน `./bin/citation` ก็ตาม เป็น string
คงที่ในโค้ด ไม่ใช่บั๊กที่กระทบการทำงานจริงตรงไหน แค่ข้อความแนะนำ
เผื่อไว้ใช้ทั้งสองทาง)

ทดสอบ idempotency ตรงๆ ด้วยการรันซ้ำอีกรอบแล้วเช็ค `git diff` —
ไม่มีอะไรเปลี่ยนแม้แต่ไบต์เดียว เพราะไม่มี timestamp ฝังอยู่ใน
frontmatter รันกี่รอบก็ได้ผลเดิมเป๊ะ ตราบใดที่ corpus ต้นทางไม่
เปลี่ยน — นี่คือเหตุผลที่ปลอดภัยจะรัน `cards` ซ้ำได้เสมอเวลาสงสัยว่า
การ์ดกับ corpus ตรงกันไหม

flag ที่ใช้บ่อยจริงๆ มีแค่หนึ่ง — ระบุ path ไฟล์ `.jsonl` อื่นแทน
ค่า default ได้ (`./bin/citation cards path/to/other.jsonl`) แต่ใน
งานจริงแทบไม่ได้ใช้เลย เพราะ corpus มีไฟล์เดียว

## 5.3 `doi` — ถาม Crossref (dry run เป็น default)

การ์ดที่เพิ่งสร้างจาก `cards` ยังไม่มี DOI ยืนยัน บางใบยังไม่มี
ชื่อผู้แต่งครบด้วยซ้ำ — `doi` คือคำสั่งที่เอาชื่อเรื่อง วารสาร ปี ไป
ถาม Crossref (หน่วยงานที่ขึ้นทะเบียน DOI จริง ไม่ใช่ AI เดาเอา)
แล้วรายงานกลับมาว่าเจอไหม มั่นใจแค่ไหน

**ข้อสำคัญที่สุดของคำสั่งนี้ — ค่า default คือ dry run** ไม่เขียน
อะไรลงการ์ดเลยจนกว่าจะสั่ง `--write` ชัดเจน นี่ไม่ใช่ความระมัดระวัง
เกินเหตุ แต่เพราะ Crossref เองก็เดาผิดได้ ให้ดูผลก่อนเชื่อ ดีกว่า
เขียนทับแล้วค่อยมาแก้

ตัวอย่างจริง — สั่งเฉพาะใบเดียวที่ยังไม่มี DOI ในทั้งคลัง
(`jarernwong2021`)

```bash
./bin/citation doi jarernwong2021
```

```
✦ resolving 1 of 62 card(s) against Crossref
  [dry run — pass --write to save]

  ? jarernwong2021 — no confident match
    (best title similarity only 0.76)
      best: [0.76] journal-article 10.3390/atmos14020261
      Health Impact Related to Ambient Particulate Matter
      Exposure as a Spatial Health Risk Map

  resolved 0 · ambiguous 1 · failed 0
```

ผลลัพธ์คือ "ไม่มั่นใจ" ตรงๆ — ผลดีที่สุดที่เจอคือ paper คนละเรื่อง
กัน (similarity แค่ 0.76 ต่ำกว่าเกณฑ์ 0.85 ที่เครื่องมือถือว่ามั่นใจ)
ปล่อยว่างไว้ดีกว่าเดาแล้วผูก DOI ผิดใบเข้ากับการ์ด — นี่คือใบเดียว
ใน 62 ใบที่ยังไม่มี DOI ตอนเขียนบทนี้ เพราะ Crossref เองไม่มี
ข้อมูลของมันจริง ๆ (ตีพิมพ์ใน Chemical Engineering Transactions ที่
Crossref ไม่ครอบคลุม)

ไม่ได้สั่งเจาะจงก็ได้ ปล่อยให้มันหาเองว่าใบไหนยังขาด — ค่า default
คือทุกใบที่ **ยังไม่มี DOI หรือยังไม่มีผู้แต่งครบ** ไม่ใช่ทั้ง 62 ใบ
เสมอไป

flag ที่ใช้บ่อย:

| flag | ทำอะไร |
|---|---|
| `--write` | เขียนผลจริงลงการ์ด (ไม่ใส่ = dry run เสมอ) |
| `--all` | เช็คซ้ำทุกใบ แม้ใบที่มี DOI อยู่แล้ว |
| `--rekey` | เปลี่ยนชื่อไฟล์จาก placeholder เป็นชื่อจริง (คีย์เก่าเก็บไว้ใน `aka:` ไม่ลบทิ้ง) |

รอบที่รันจริงกับ `--write` ตลอดทั้งคลัง (ก่อนเขียนบทนี้) ได้ DOI
เพิ่มจาก 8/62 เป็น 61/62 — ระหว่างทางเจอ error 18 จุดใน 14 การ์ด
ด้วย ส่วนใหญ่เป็นวารสารผิด หน้าเลขผิด หรือผู้แต่งคนแรกผิด (Crossref
คือแหล่งข้อมูลจากผู้ตีพิมพ์เอง เชื่อได้มากกว่า JSONL ต้นทาง) —
รายละเอียดครบอยู่ที่ `artifacts/citation-audit.md`

## 5.4 `bib` — การ์ด → `artifacts/citation.bib`

พอการ์ดมี DOI กับผู้แต่งครบพอสมควรแล้ว `bib` แปลงทุกใบเป็น
BibTeX entry เดียวรวมเป็นไฟล์เดียว พร้อม `\cite{}` ตรงกับชื่อไฟล์
การ์ดเป๊ะ

```bash
./bin/citation bib
```

```
✦ 62 citable entries → …/artifacts/citation.bib
  61/62 carry a DOI · 1 without

Use in LaTeX:  \bibliography{artifacts/citation}
  then \cite{adong2025}
```

"citable" ในที่นี้ไม่ได้แปลว่า "มี DOI" — แปลว่ามีผู้แต่ง ชื่อเรื่อง
วารสาร ปี ครบ (DOI อยากได้ แต่ไม่ใช่เงื่อนไขบังคับ) การ์ดที่ยัง
ขาดผู้แต่งจะถูก**คอมเมนต์ไว้ในไฟล์ ไม่ใช่ตัดทิ้ง** — เปิด
`artifacts/citation.bib` จะเห็นส่วน `withheld` ต่อท้าย บอกตรงๆ ว่า
ใบไหนขาดอะไร แก้ด้วย `citation doi --write` แล้วรัน `bib` ใหม่
ก็ครบ

flag ที่ใช้บ่อยมีตัวเดียว — `--by-topic` จัดกลุ่ม entry ตาม 6 หัวข้อ
แทนเรียงตาม citekey ตรงๆ มีประโยชน์เวลาจะเขียนบท related work
ทีละหัวข้อ ไม่ต้องไล่หา entry กระจัดกระจาย

ไฟล์ที่ได้ผ่านการตรวจด้วย `bibtex` จริงจาก TeX Live 2026 แล้ว — 62
entry เข้า 62 `\bibitem` ตรงกันเป๊ะ warning เท่ากับ 0 (บทที่ 3 เล่า
เรื่องบั๊ก NUL byte ที่เกือบทำให้เข้าใจผิดว่าโค้ดส่วนนี้ไม่ได้ใช้
`sharp` ไปแล้ว — คำสั่งเดียวกันนี่แหละที่เป็นต้นเหตุ)

## 5.5 `index` / `search` — และ `--vault` ที่รวม paper กับ note

`index` เอาข้อความจากการ์ดไปแปลงเป็นเวกเตอร์ 1024 มิติผ่าน
ollama แล้วเก็บลง store — ทำครั้งแรกหลัง `cards` เสร็จ แล้วทำซ้ำ
ทุกครั้งที่แก้ title/summary/relevance ของการ์ด (แก้แค่ `doi:`
เฉยๆ ไม่ต้อง index ใหม่ เพราะ field นั้นไม่ได้ถูก embed)

```bash
./bin/citation index --vault
```

```
Loaded 62 paper card(s) from …/ψ/papers
Loaded 13 vault note(s) from ψ/memory/learnings,
  ψ/memory/retrospectives, ψ/memory/resonance,
  ψ/writing/research
Embedded 75 item(s) in batches of 16
Wrote …/.maw/citation-data/store — 75 × 1024-dim
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

(หมายเหตุ path ของ store — รอบนี้ shell ที่รันมี `MAW_HOME` export
ไว้ ผลคือได้ path แบบ `maw` คือ `.maw/citation-data/store` ส่วน
บล็อก `status` ในหัวข้อ 5.1 มาจากอีก session หนึ่งที่ไม่มี
`MAW_HOME` เลยรายงาน root ด้วยกฎ "walk up from the script" แทน แล้ว
เก็บ store ไว้ที่ `<repo>/.citation/store` — เครื่องเดียวกันเป๊ะ แต่
คนละ shell session ให้ผลลัพธ์ต่างกันได้ นี่แหละคือเหตุผลที่ `status`
ต้องพิมพ์บอกกฎที่ใช้ทุกครั้ง ไม่งั้นสับสนได้ง่ายว่า store อยู่ตรงไหน
กันแน่)

`--vault` คือ flag ที่ใช้บ่อยที่สุดของ `index` — ไม่ใส่ก็ได้ index
แค่ 62 paper ใส่แล้ว search จะครอบคลุมโน้ตในวอลต์ด้วย (retro,
learning, research draft) ค้นครั้งเดียวเจอทั้งสิ่งที่คนอื่นเขียนไว้
และสิ่งที่เราคิดเองปนกัน

store ไม่ใช่ database — เป็นไฟล์ธรรมดา 3 ไฟล์ (`vectors.f32`
`meta.jsonl` `manifest.json`) `manifest.json` ล็อกชื่อ model ไว้
ด้วย เปลี่ยน model เมื่อไหร่ต้อง `index` ใหม่ทั้งชุดเสมอ เพราะ
เวกเตอร์จากคนละ model เทียบกันไม่ได้เลย

พอ index เสร็จ ค้นได้ทันทีด้วย `search`

```bash
./bin/citation search "low-cost sensor calibration PM2.5" -k 3
```

```
Top 3 result(s) for "low-cost sensor calibration PM2.5
reference monitor":

  [0.6481] 📄 paper \cite{bulot2023}
  (low-cost-sensor-calibration) Bulot (2023) --
  Reference-Grade from Low-Cost Sensors
    Heliyon (Q1)
    ψ/papers/bulot2023.md

  [0.6287] 📝 note (ψ/writing/research) Environmental
  prediction models for PM2.5 — and the prior art we
  must confront
    ψ/writing/research/2026-07-25_environmental-
    prediction-models.md

  [0.5771] 📄 paper \cite{scientificreports2025}
  (low-cost-sensor-calibration) Scientific Reports
  (2025) -- ML Mixed Correction
    Scientific Reports (Q1)
    ψ/papers/scientificreports2025.md
```

ผลลัพธ์อันดับสองไม่ใช่ paper แต่เป็นโน้ตของเราเอง (📝) — นี่คือสิ่ง
ที่ `--vault` ตอน index เปิดทางไว้ ไม่ต้องแยกค้นสองรอบ

flag ที่ใช้บ่อย — `-k N` กำหนดจำนวนผลลัพธ์ (default 5) กับ
`--json` เปลี่ยน output เป็น JSON ล้วนสำหรับต่อ pipe เข้าสคริปต์อื่น

```bash
./bin/citation search "burning season northern Thailand" -k 1 --json
```

```json
[
  {
    "similarity": 0.5625,
    "kind": "paper",
    "citekey": "wongnakae2023",
    "id": "paper:wongnakae2023",
    "title": "Wongnakae et al. (2023) -- RF PM2.5 in Northern Thailand",
    "journal": "Environmental Science and Pollution Research (Q2)",
    "topic": "thailand-burning-season",
    "path": "ψ/papers/wongnakae2023.md"
  }
]
```

การค้นทั้งหมดนี้ไม่มี database ไม่มี index แบบ ANN ซับซ้อนอยู่
เบื้องหลัง — เป็น brute-force cosine ล้วน ๆ ที่เขียนด้วย TypeScript
ตรง ๆ วิ่งผ่านทั้ง 75 แถวใช้เวลาราว 0.2 วินาที (รวมเวลา embed
คำค้นด้วยแล้ว) เพราะข้อมูลมีแค่หลักสิบ ไม่ถึงหลักล้าน — ความซับซ้อน
แบบนั้นยังไม่จำเป็น

## 5.6 `serve` / `graph` — ดูกลุ่มดาว

พอ store พร้อม สองคำสั่งสุดท้ายเอาไว้**มอง**ความสัมพันธ์ระหว่าง
paper แทนการอ่านทีละแถว — ทั้งคู่คำนวณ cosine similarity ระหว่าง
ทุกคู่ paper แล้ววาดเป็นเส้นเชื่อม (นี่แหละคือ citation graph ตัวจริง
ของเล่มนี้ ไม่ใช่ใครอ้างอิงใคร แต่เป็นใครใกล้เคียงกันเชิงความหมาย)

`serve` (ชื่อเล่นคือ `visualize` — เรียกได้ทั้งสองแบบ) เปิด server
ที่ localhost แบบ interactive ลาก ซูม hover ดูรายละเอียดได้สด default
port คือ 5556 แต่ถ้าพอร์ตนั้นถูกใช้อยู่แล้ว (จาก `serve` รอบก่อนที่
ยังไม่ได้ปิด) มันจะขยับไปพอร์ตถัดไปเองอัตโนมัติ ไม่ล้มแล้วโยน error
`EADDRINUSE` ใส่หน้า

```bash
./bin/citation serve --port 5570
```

```
✦ citation constellation (2D) — http://localhost:5570
62 papers · 6 topics · 71 edges (sim > 0.68)
drag to pan · scroll to zoom · hover a star · click a
star for full detail · search to highlight

── verbose ──
  embeddings   @cf/baai/bge-m3 · 1024-dim · 62 papers
  layout       t-SNE (PCA-init, deterministic) in 360 ms
  similarity   max 0.819 · mean 0.541 over 1891 pairs
  edges        71 of 1891 pairs above 0.68 (3.8%)
  isolated     15 paper(s) with no edge at this threshold
  topics
        9  health-policy
       14  low-cost-sensor-calibration
        6  multi-source-fusion-qa
        6  reference-monitoring-bam
       16  satellite-pm25-products
       11  thailand-burning-season
  most-connected
        8  Nakapan & Hongthong (2022)
        6  Buya et al. (2023)
        6  Choi et al. (2019)
        6  O et al. (2025)
        6  Thongsame et al. (2025)
Ctrl+C to stop
```

ตัวเลขที่น่าสนใจคือ "isolated 15 paper(s)" — 15 ใบใน 62 ไม่มีเส้น
เชื่อมถึงใครเลยที่ threshold 0.68 ไม่ใช่บั๊ก แค่แปลว่า paper พวกนั้น
เนื้อหาห่างจากใบอื่นในคลังพอสมควร ลด threshold ลงถึงจะเริ่มเห็น
เส้นบางๆ โผล่มา

ส่วน `graph` เอาผลลัพธ์แบบเดียวกัน render เป็นไฟล์นิ่ง — SVG กับ
PNG ที่แนบเข้าเอกสารได้ตรงๆ ไม่ต้องมี server ค้างไว้

```bash
./bin/citation graph
```

```
✦ citation graph → …/artifacts/citation-network.svg
✦ png            → …/artifacts/citation-network.png
62 papers · 6 topics · 1336 edges (cosine > 0.5, max
observed 0.817)
dense — raise threshold for a cleaner graph:
maw citation graph --threshold 0.60
```

threshold default ของ `graph` (0.5) ต่ำกว่าของ `serve` (0.68) โดย
ตั้งใจ — ผลคือ 1336 เส้นทันที เครื่องมือเองเตือนตรงๆ ว่า "dense" พร้อม
บอกเลขที่ควรลอง (0.60) ไม่ใช่แค่บอกว่าเยอะไปเฉยๆ

flag ที่ใช้บ่อยของทั้งคู่ — `--threshold N` ปรับความเข้มของเส้น
(ตัวเลขสูง = เส้นน้อยลงแต่มั่นใจกว่า) `--quiet` (เฉพาะ `serve`) ตัด
ส่วน verbose ทิ้งเหลือแค่ banner กับ URL และ `--html` (เฉพาะ
`graph`) เขียนหน้า interactive แบบเดียวกับ `serve` ออกมาเป็นไฟล์
`.html` เปิดในเบราว์เซอร์ได้โดยไม่ต้องรัน server เลย

PNG ต้องมี `sharp` ถึงจะออกได้ (บทที่ 3 เล่าไปแล้วว่าเป็น optional
dependency ตัวเดียวในทั้ง repo) — ไม่มีก็ไม่พัง แค่ได้ SVG อย่าง
เดียวพร้อมข้อความ `(png skipped — 'sharp' not installed; the SVG
above is the figure)` ซึ่งจริงๆ ก็คมกว่า PNG อยู่แล้วในฐานะ vector
image

## 5.7 ลำดับที่ใช้จริงตอนเริ่มจากศูนย์

รวมทั้ง 8 คำสั่งเป็นเส้นทางเดียวสำหรับคน clone repo นี้มาครั้งแรก
copy ทั้งก้อนไปรันได้เลย ไม่ต้องแก้อะไร (แค่ `ollama pull` ใช้เวลา
ตามความเร็วเน็ต ส่วนที่เหลือเป็นวินาที)

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

เก้าขั้นตอนแต่ 8 คำสั่ง (`doi` ปรากฏสองครั้ง — dry run ก่อน แล้วค่อย
`--write`) จากศูนย์ถึงมี `.bib` พร้อมส่งวิทยานิพนธ์ กับแผนที่ดาว
ให้มอง ใช้เวลาไม่ถึงห้านาทีบนเครื่องที่มี ollama รันอยู่แล้ว

แต่คำถามที่ยังไม่ตอบคือ ระหว่างบรรทัดที่ 7 กับ 8 ข้างบนนั้น — ตอน
`embed` เกิดอะไรขึ้นจริงๆ ข้างใน ทำไม field บางตัวถูกนำไปแปลงเป็น
เวกเตอร์ บางตัวไม่ถูกแตะเลย แล้ว cosine similarity ที่เห็นเป็นตัวเลข
สวยๆ ในทุกบล็อกข้างบนนั้น มันวัดอะไรกันแน่ — ภาค 2 ทั้งภาคหน้านี้
ตอบคำถามนั้นทีละชั้น เริ่มจากบทที่ 6
