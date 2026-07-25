# คู่มือ: paper cards + การ index ด้วยมือ

> เก็บ paper แบบเดียวกับที่ oracle เก็บความทรงจำ — markdown 1 ไฟล์ = 1 paper
> มี frontmatter ให้ machine อ่าน มี body ให้คนอ่าน แล้ว index รวมกับ note ของเราได้

**ที่นี่คือ source of truth** ไม่ใช่ `artifacts/literature_corpus.jsonl` — JSONL เป็นแค่
ช่องทาง import ตอนเริ่ม ถ้าจะแก้อะไรให้แก้ card

- [`INDEX.md`](INDEX.md) — สารบัญ (generate อัตโนมัติ **ห้ามแก้มือ** เดี๋ยวถูกทับ)
- `<citekey>.md` — card ของแต่ละ paper · ชื่อไฟล์ = citekey = คีย์ที่ใช้ใน `\cite{}`

---

## 1. Manual index ทำยังไง (คำถามหลัก)

Index คือการเอาข้อความในแต่ละ card ไป **embed เป็น vector** แล้วเก็บลง store ในเครื่อง
(`$MAW_HOME/citation-data/store/` — ไฟล์ธรรมดา 3 ไฟล์ ไม่ต้องลง database) เพื่อให้ `search` / `graph` / `serve` ใช้งานได้ ทุกครั้งที่แก้ card ต้อง index ใหม่

### ก่อน index — ต้องมี embedder ตัวใดตัวหนึ่ง

ตัวปลั๊กอินจะ**เลือกให้เอง** ตามลำดับนี้:

| ลำดับ | Backend | เงื่อนไข | หมายเหตุ |
|---|---|---|---|
| 1 | **ollama** (local) | มี `bge-m3` และ ollama รันอยู่ | ใช้ GPU เครื่องเรา ไม่ต้อง token ไม่ออกเน็ต ← default |
| 2 | Cloudflare worker | worker รันที่ `:18787` | ผ่าน wrangler login เดิม |
| 3 | Cloudflare REST | มี `CF_ACCOUNT_ID` + `CF_API_TOKEN` | ใช้ token จริง |

**แบบ local (แนะนำ)** — ครั้งแรกโหลด model เข้า GPU อาจนาน 1-2 นาที หลังจากนั้นเร็ว (~0.2s ต่อครั้ง):

```bash
ollama pull bge-m3          # 1.2 GB ครั้งเดียว
ollama serve                # ปกติ Ollama.app รันอยู่แล้ว
```

**แบบ cloud (ถ้าไม่อยากลง model)**:

```bash
cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787
```

บังคับเลือกเองได้ด้วย `CITATION_EMBED=ollama|worker|cf-rest`

เช็คว่าใช้ตัวไหนอยู่: `maw citation status` จะบอกบรรทัด `embeddings: ...`

> ⚠️ **model ต้องไม่สลับกลางทาง** — vector จาก model ต่างกันเทียบกันไม่ได้ ตัว store จะจำ
> `model` ที่ใช้ไว้ใน `manifest.json` ถ้าเปลี่ยน model ต้อง `index` ใหม่ทั้งชุด

### สั่ง index

**มี maw:**

```bash
cd /opt/Code/github.com/Soul-Brews-Studio/phd-citation-oracle
export MAW_HOME="$PWD/.maw"        # ถ้ายังไม่ได้ direnv allow

maw citation index                 # papers เท่านั้น (อ่านจาก card อัตโนมัติ)
maw citation index --vault         # papers + note ของเรา (retro/lesson/research)
```

**ไม่มี maw ก็ได้** — ใช้ `./bin/citation` แทน คำสั่งเหมือนกันหมด สั่งจากที่ไหนก็ได้
(มันเดินขึ้นไปหา `CLAUDE.md` + `ψ/` เองจากตำแหน่งของ script):

```bash
./bin/citation index --vault
./bin/citation search "..."
./bin/citation serve
```

| ทางที่หา repo root | เมื่อไหร่ |
|---|---|
| `CITATION_ROOT` | ตั้ง env เอง (override) |
| `MAW_HOME` | รันผ่าน maw — พฤติกรรมเดิมไม่เปลี่ยน |
| เดินขึ้นจาก script | `./bin/citation` — ใช้ได้ทุก cwd |
| เดินขึ้นจาก cwd → `git rev-parse` → cwd | fallback ตามลำดับ |

`maw citation status` / `./bin/citation status` บรรทัดแรกจะบอกว่าหา root เจอด้วยวิธีไหน

> store จะแยกกัน: ผ่าน maw ไปที่ `$MAW_HOME/citation-data/store`, แบบ standalone ไปที่
> `<repo>/.citation/store` (gitignored ทั้งคู่ ลบแล้ว index ใหม่ได้)

`--vault` คือตัวที่ทำให้ **ค้นหา paper กับความคิดของเราเจอในที่เดียว** — ผลลัพธ์จะแยกให้ว่า
อันไหนเป็น `📄 paper` อันไหน `📝 note`

### ต้อง index ใหม่เมื่อไหร่

| เกิดอะไรขึ้น | ต้อง index ใหม่? |
|---|---|
| แก้ `**Key findings**` / `**Thesis relevance**` / `## Notes` ใน card | ✅ ต้อง |
| เพิ่ม card ใหม่ | ✅ ต้อง |
| แก้ `topic:` ใน frontmatter | ✅ ต้อง (topic ใช้ลงสีใน graph) |
| เติม `doi:` เฉยๆ | ❌ ไม่ต้อง (ไม่ได้ถูก embed) |
| เขียน retro / lesson ใหม่ | ✅ ถ้าอยากให้ค้นเจอ — `index --vault` |

index เป็น **idempotent** — สั่งซ้ำได้ ไม่พัง ข้อมูลเดิมถูก update ตาม `id`

---

## 2. เพิ่ม paper ใหม่ด้วยมือ

### วิธีที่เร็วสุด — copy card ที่มีอยู่

```bash
cd ψ/papers
cp mahajan2025.md kawichai2026.md     # ตั้งชื่อไฟล์ = citekey ที่จะใช้ใน \cite{}
$EDITOR kawichai2026.md
```

แล้วแก้ frontmatter ให้ครบ:

```yaml
---
citekey: kawichai2026          # ← ต้องตรงกับชื่อไฟล์
id: "2.5.12"                   # เลข section ในเล่ม (ใช้เรียงลำดับใน INDEX.md)
title: "ชื่อ paper เต็ม"
short_title: "ชื่อสั้นที่จะโชว์บน graph"
authors:
  - "Kawichai, S."
  - "Sripan, P."
year: "2026"
journal: "Toxics"
quartile: "Q2"
impact_factor: "3.9"
volume: "13"
pages: "170"
doi: "10.3390/toxics13030170"
topic: "thailand-burning-season"   # ← ต้องเป็น 1 ใน 6 topic เดิม ไม่งั้นสีใน graph จะเพี้ยน
status: ok                         # ok | needs-authors
tags: [paper, thailand-burning-season]
kind: paper                        # ← ห้ามลบ ตัวนี้แยก paper ออกจาก note ตอน index
---
```

body เขียน 3 ก้อนนี้ (รูปแบบสำคัญ — parser จับจาก `**...** —`):

```markdown
# Kawichai & Sripan (2026) — ชื่อสั้น

**Key findings** — เจออะไร ใส่เลขจริง (R², RMSE, %) ให้ครบ

**Thesis relevance** — เกี่ยวกับงานเรายังไง ตรงนี้คือของที่ทำให้ search ฉลาด

**Full citation** — reference เต็มแบบ APA

## Notes

โน้ตของเราเอง — ตรงนี้ `maw citation cards` **ไม่ทับ**
```

แล้ว `maw citation index` ปิดท้าย

### 6 topic ที่ใช้อยู่

`low-cost-sensor-calibration` · `satellite-pm25-products` · `thailand-burning-season` ·
`health-policy` · `reference-monitoring-bam` · `multi-source-fusion-qa`

---

## 3. Regenerate จาก JSONL (import ใหม่ทั้งชุด)

```bash
maw citation cards                 # เขียน card ทั้ง 56 ใบใหม่จาก JSONL + citation ของ parent
```

**สิ่งที่รอด** เวลา regenerate: ทุกอย่างใต้ `## Notes` และ `doi:` ที่เราเติมไว้
**สิ่งที่ถูกทับ**: frontmatter อื่น ๆ กับ body 3 ก้อน (เพราะ generate จาก JSONL)

ถ้าจะแก้อะไรให้ถาวรและไม่อยู่ในสองอย่างข้างบน → แก้ JSONL ด้วย หรือเลิกใช้ `cards` แล้วแก้
card ตรง ๆ อย่างเดียว (card คือ canonical แล้ว `cards` เป็นแค่ importer)

---

## 4. ตรวจว่างานเข้าจริง

```bash
maw citation status                          # cards + store + embedder ครบไหม
maw citation search "ที่เพิ่งเพิ่มเข้าไป" -k 5   # หาเจอไหม
maw citation graph --threshold 0.68 --html   # ออกมาในแผนที่ไหม
maw citation serve                           # เปิดดูแบบ interactive
```

`status` จะบอกจำนวน paper ที่ index ไว้ — ถ้าเลขไม่ขยับหลังเพิ่ม card แปลว่ายังไม่ได้ index

---

## 5. Troubleshooting

| อาการ | สาเหตุ + วิธีแก้ |
|---|---|
| `no embedding backend reachable` | ไม่มีทั้ง ollama และ worker → `ollama serve` หรือเปิด worker (ดูข้อ 1) |
| embed error กลางทาง | batch ใหญ่เกิน → `CF_EMBED_BATCH=8 maw citation index --vault` (default 16) |
| `no cards in ψ/papers and no corpus` | ยังไม่เคย generate → `maw citation cards` ก่อน |
| `nothing indexed yet` | store ว่าง → `maw citation index` |
| ผลลัพธ์แปลกๆ หลังเปลี่ยน model | vector คนละ model → `maw citation index --vault` ใหม่ทั้งชุด |
| card ใหม่ไม่โผล่ใน graph | ลืม `kind: paper` ใน frontmatter หรือลืม index |
| ชื่อบน graph เพี้ยน | `authors:` หรือ `year:` ว่าง → label ตกไปใช้ชื่อ journal แทน |

---

## 6. งานที่ค้างอยู่

**9 card ยังไม่มีชื่อ authors** เพราะ reference list ของ parent เขียนว่า `[Authors]` ไว้จริง ๆ —
ไม่ได้เดาให้ ดูรายการท้าย [`INDEX.md`](INDEX.md) พวกนี้ต้องหา authors จริงก่อนจะทำ `.bib` ได้:

```bash
rg -l 'status: needs-authors' ψ/papers/
```

**DOI ตอนนี้มี 8/62 card** (ยืนยันกับ Crossref แล้วทุกตัว) ที่เหลือยังว่าง — corpus ต้นทาง
ไม่มี DOI เลย เติมได้ 2 ทาง: ใน page interactive กดชื่อ paper แล้วมีปุ่มลิงก์ไป
Crossref/Scholar หรือใช้ skill `/paper-card` แล้วสั่ง `fix-authors`

```bash
rg -c '^doi: "10\.' ψ/papers/*.md | wc -l     # นับ card ที่มี DOI แล้ว
```

---

## 7. store อยู่ไหน / หน้าตายังไง

ไม่ได้ใช้ database — เป็นไฟล์ธรรมดา 3 ไฟล์ ที่ `$MAW_HOME/citation-data/store/`:

| ไฟล์ | คืออะไร |
|---|---|
| `vectors.f32` | Float32 ต่อกันเป็นแถว (N × 1024) — 73 แถวประมาณ 292 KB |
| `meta.jsonl` | 1 บรรทัด = 1 แถว (id/kind/citekey/title/topic/path/text) เรียงตรงกับ vectors |
| `manifest.json` | `{ model, dim, count, updated }` — จำไว้ว่า index ด้วย model ไหน |

ลบทิ้งได้ตลอด แล้ว `maw citation index --vault` สร้างใหม่ (derived data — gitignored)

การค้นหาเป็น brute-force cosine ใน TS ล้วน ๆ ไม่ต้องมี ANN index: 73 แถวใช้เวลา ~0.2s
รวม embed query แล้ว ระดับหลักแสนแถวก็ยังไม่ถึงวินาที

---

*Citation Oracle ✦ — "ทุกข้อกล่าวอ้างต้องมีดาวดวงอื่นค้ำไว้"*
