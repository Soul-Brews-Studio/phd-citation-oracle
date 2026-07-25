# บทที่ 2: เตรียมของ — ต้องมีอะไรบ้าง (จริงๆ แค่ 2 อย่าง)

บทนี้คือ checklist ติดตั้ง — ของที่ต้องลง ของที่ควรลง ของที่ไม่ต้องแตะเลย

| กอง | ของ | สถานะ |
|---|---|---|
| ต้องมี | bun (runtime) | ขาดไม่ได้ — ทุกคำสั่งวิ่งผ่านตัวนี้ |
| ควรมี | ollama + bge-m3 | จำเป็นเฉพาะ `search` / `index` |
| ไม่ต้องมี | node_modules, database, API key, Docker | ตัดออกจาก repo แล้ว |

## ต้องมี: bun เท่านั้น

```bash
bun --version
# เห็นเลขเวอร์ชัน = พร้อม ไม่มีก็ลงตามทางการที่ bun.sh ขั้นตอนเดียวจบ
```

`ψ/lab/citation/package.json` ยืนยันว่าว่างจริง ไม่ใช่ตัวเลขน้อยแล้วโฆษณาว่าลดแล้ว

```json
{
  "dependencies": {},
  "optionalDependencies": { "sharp": "^0.33.5" },
  "devDependencies": { "@types/bun": "^1.3.0" }
}
// sharp เสริม PNG เท่านั้น · @types/bun แค่ให้ editor autocomplete
```

`dependencies` ว่าง → `bun install` ไม่มีอะไรให้ทำ ข้ามได้เลย ลองจริง

```bash
git clone https://github.com/Soul-Brews-Studio/phd-citation-oracle
cd phd-citation-oracle
./bin/citation status
```

สามบรรทัด ไม่มีขั้นเตรียมเครื่องแทรกกลาง ไม่มี lockfile ชนกัน
ไม่มี "รันเครื่องฉันได้ แต่เครื่องเธอไม่ได้" เพราะไม่มี package ให้ resolve ตั้งแต่ต้น

## ควรมี: ollama + bge-m3

`status` `cards` `doi` `bib` ใช้ bun ล้วนพอ — ครึ่งหนึ่งของ 8 คำสั่งไม่แตะ embedding เลย
เฉพาะ `search` กับ `index` ที่ต้องแปลงข้อความเป็นเวกเตอร์ 1024 มิติ

```bash
brew install ollama
ollama pull bge-m3   # ~634 MB, ctx window 8192
```

ไม่ลงก็ไม่ตาย — เสีย `search`/`index` ไป อีก 6 คำสั่งใช้ได้ปกติ
ทุกอย่างรันในเครื่อง ไม่มี API key ไม่มี rate limit ของ third party
corpus วิทยานิพนธ์ไม่ต้องออกจากเครื่องสักไบต์เดียว (cloud worker สำรองที่ใช้
bge-m3 ตัวเดียวกัน — เล่าในบทที่ 10, ตอนนี้ยังไม่ต้องแตะ)

## ไม่ต้องมี

| ของ | เหตุผล |
|---|---|
| `node_modules` | ไม่มี dependency ให้ install ตั้งแต่แรก |
| database | vector store เป็นไฟล์แบนสามไฟล์ เปิดด้วย text editor ได้ตรง |
| API key | เส้นทาง default รันในเครื่องทั้งหมด ไม่มี `.env` ให้ระวังหลุด |
| Docker | ไม่มี service ไหนต้องแยก process ออกไปรันนอก bun |

**487 MB → 140 KB**: เคยมี `@lancedb/lancedb` (vector DB เต็มรูป) + `sharp`
เป็น hard dependency จนติดตั้งหนัก 487 MB ก่อน commit `5475615` ตัดทั้งคู่ทิ้ง
— corpus แค่ 62 ใบ ไม่ใช่ 6.2 ล้านใบ brute-force cosine ในไฟล์ TS ล้วนก็เร็วพอ

## สองทางเข้า หนึ่ง implementation

```bash
./bin/citation status      # ต้องมีแค่ bun — ไม่ต้องมี maw
maw citation status        # เหมือนกันทุกอย่าง สำหรับคนที่มี maw
```

ทั้งสองเรียก handler เดียวกันจาก `ψ/lab/citation/src/index.ts`
แก้ logic ที่เดียว ผลตรงกันเสมอ ไม่มี dispatch สองชุดให้ดูแลคู่ขนาน

หา repo root ตามลำดับนี้ — เจอข้อไหนก่อน ใช้ข้อนั้น หยุดค้นทันที

| ลำดับ | แหล่ง |
|---|---|
| 1 | env `CITATION_ROOT` |
| 2 | env `MAW_HOME` (มีเสมอถ้ารันผ่าน maw) |
| 3 | ไล่ขึ้นจากตำแหน่งสคริปต์เอง หา `CLAUDE.md` + `ψ/` |
| 4 | ไล่ขึ้นจาก working directory ปัจจุบัน กฎเดียวกัน |
| 5 | `git rev-parse --show-toplevel` |
| 6 | working directory ปัจจุบัน (fallback สุดท้าย) |

ข้อ 3 กันบั๊กเดิม — `bin/citation` นอนอยู่ *ข้างใน* repo เสมอ `cd` ไปที่ไหน
ก็ยังเจอ root ถูก (commit `051014b`) ก่อนแก้ รันนอก repo แล้วเงียบๆ
รายงาน "0 paper cards" กลับมา ไม่ error ไม่เตือน

store เก็บที่ `$MAW_HOME/citation-data/store` (ผ่าน maw) หรือ
`<repo>/.citation/store` (standalone) — ไฟล์ชุดเดียวกัน ต่างแค่ตำแหน่ง

## เช็คว่าพร้อมหรือยัง: `./bin/citation status`

```bash
./bin/citation status
```

output จริงจากเครื่อง m5 (Apple M5 Max)

```
── citation status ──
  ✓ repo root: .../phd-citation-oracle (walk up from the script)
  ✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
  ✓ corpus present (artifacts/literature_corpus.jsonl) — 23814 bytes
  ✓ store ready (…/.citation/store) — 62 paper(s) + 13 vault note(s)
      · 1024-dim · 300 KB · model ollama:bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified memory
      — Metal GPU available to ollama
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434
      — local, no token, no egress — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU (fully resident) · 8192 ctx
  ✓ arra-oracle-v3 reachable (http://localhost:47778) — ok [optional]
```

ไล่ทีละบรรทัด

| บรรทัด | บอกอะไร |
|---|---|
| `repo root` | เจอ repo ด้วยกฎข้อไหนในหกข้อ — ผิดตรงนี้ บรรทัดถัดไปพังหมด |
| `62 paper card(s) ... 61 with a DOI` | จำนวนการ์ดจริง กับจำนวนที่มี DOI ยืนยันแล้ว |
| `corpus present ... 23814 bytes` | ไฟล์ต้นทาง JSONL ยังอยู่ครบ — เป็นทาง import ไม่ใช่ของจริง |
| `store ready ... 300 KB` | vector store พร้อมค้น กี่แถว ขนาดเท่าไหร่ model ไหน |
| `hardware: ...` | สเปกเครื่องตอนนี้ มี GPU ให้ ollama ใช้หรือเปล่า |
| `embeddings: ollama bge-m3 ...` | backend ที่ใช้จริง ยืนยัน local ไม่มี token |
| `└ bge-m3:latest ... 8192 ctx` | โมเดลอยู่ GPU เต็มๆ หรือหล่นไป CPU |
| `arra-oracle-v3 ... [optional]` | ระบบเสริมของทีม ไม่มีก็ไม่กระทบ verb ไหนของ citation |

จุดควรรู้ "61 with a DOI" ไม่ใช่ 62 เต็ม เพราะ `jarernwong2021` หา DOI จาก
Crossref ไม่เจอจริง — เก็บช่องว่างไว้ดีกว่าใส่เลขมั่ว (ผลจากงานตรวจสอบบทที่ 1
ซึ่งเริ่มจาก 8/62) source of truth คือการ์ดใน `ψ/papers/` ไม่ใช่ JSONL —
วันไหนขัดกัน เชื่อการ์ด

ของที่ต้องมีจริงๆ ก็แค่นี้ bun หนึ่งตัว ollama + bge-m3 อีกคู่
ที่เหลือคือของเสริม บทหน้าไล่ทีละตัว
