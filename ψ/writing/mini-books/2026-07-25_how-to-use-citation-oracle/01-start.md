## §1 — เริ่มใช้ใน 3 คำสั่ง (ไม่ต้องลงอะไรเลย)

**3 คำสั่ง แล้วเห็นข้อมูลจริง — ไม่ต้อง npm install ไม่ต้องตั้ง database**

```bash
git clone https://github.com/Soul-Brews-Studio/phd-citation-oracle.git
cd phd-citation-oracle
./bin/citation status
```

แค่นี้ครับ. `git clone` ได้ repo มา cd เข้าไป แล้วรัน `./bin/citation status` ได้เลย — ไม่มี `bun install`, ไม่มี `node_modules`, ไม่มี database ให้ตั้งค่า. ต้องการแค่ bun ตัวเดียวในเครื่อง.

อยากลอง search กับ serve ต่อ ก็สั่งแบบเดียวกันนี้ได้เลย ไม่ต้องตั้งค่าอะไรเพิ่ม:

```bash
./bin/citation search "PM2.5 calibration low-cost sensor"
./bin/citation serve
```

`search` ค้นจาก store ที่ index ไว้แล้ว (ดูรายละเอียด index/store ใน status ด้านล่าง) ส่วน `serve` เปิด server ขึ้นมาให้เปิดดูใน browser ได้ — สองคำสั่งนี้พึ่ง `status` ผ่านไปก่อนเท่านั้น ไม่พึ่งอะไรอื่น.

## สอง entry point หนึ่ง implementation

`./bin/citation <verb>` กับ `maw citation <verb>` เรียก handler ตัวเดียวกัน — โค้ดตัวเดียว export ออกมาให้เรียกได้ สองทางเข้านี้แค่ห่อกันคนละชั้นเท่านั้น ไม่มีสองชุด logic ให้ diverge กันทีหลัง. ใครไม่มี `maw` ติดตั้งในเครื่อง ใช้ `./bin/citation` ตรง ๆ ได้ ทำงานเหมือนกันทุกอย่าง ไม่มีฟีเจอร์ไหนหายไปเพราะไม่มี `maw` — นี่คือเหตุผลที่ตัวอย่างในบทนี้ทั้งหมดใช้ `./bin/citation` เป็นหลัก มันคือ path ที่ทำงานได้แน่นอนที่สุดไม่ว่าใครจะ clone ไปรันจากไหน. ใครมี `maw` อยู่แล้ว จะเรียก `maw citation` แทนก็ได้ ผลลัพธ์เหมือนกันเป๊ะทุกบรรทัด. Verb ที่มีตอนนี้: `status` `cards` `doi` `bib` `index` `search` `serve` (alias `visualize`) `graph` — แปดคำ ครอบตั้งแต่เช็คสุขภาพระบบ ไปจนถึงวาดกราฟความสัมพันธ์ระหว่าง paper.

## ทำไม 140 KB ถึงพอ

เคยหนัก 487 MB มาก่อน. ตอนนั้นแบก LanceDB กับ sharp ไว้ — vector database เต็มรูปแบบ กับ image-processing library ที่กิน binary ไปเยอะ. Commit `5475615` ถอดทั้งคู่ออก เปลี่ยนไปใช้ local GPU embeddings ผ่าน ollama กับ plain-file vector store แทน. ผลคือทั้งระบบเหลือติดตั้งแค่ 140 KB — ไม่มี dependency เหลือเลยสักตัว. Zero-dependency ในที่นี้คือของจริง ไม่ใช่แค่ "dependency น้อยลง" — clone มาแล้วรันได้เลยคือคำพิสูจน์.

## Root resolution — ทำไมรันจาก /tmp ก็ยังเจอ

Repo root หาตามลำดับนี้: `CITATION_ROOT` → `MAW_HOME` → **ไล่ขึ้นจาก SCRIPT** หา `CLAUDE.md` กับ `ψ/` → ไล่ขึ้นจาก cwd → `git rev-parse --show-toplevel` → cwd. Commit `051014b` คือตัวที่ใส่กฎนี้เข้ามา ให้ `./bin/citation` ทำงานได้แม้ไม่ได้ยืนอยู่ใน repo เลยด้วยซ้ำ — สั่งจาก `/tmp` ก็ยังหา root เจอ เพราะตัว script รู้ตำแหน่งของตัวเอง แล้วไล่ขึ้นจากจุดนั้น แทนที่จะพึ่ง cwd เป็นหลักอย่างเดียว.

จุดที่ต้องระวังคือ root ผิด ระบบไม่ throw error ให้เห็นทันที — มันแค่รายงาน "0 paper cards" เงียบ ๆ หน้าตาเหมือนข้อมูลหายไปทั้งกอง ทั้งที่จริงแค่มองผิด directory. `status` เลยพิมพ์บอกด้วยทุกครั้งว่า **กฎไหนชนะ** กันไม่ให้เข้าใจผิดว่าข้อมูลหาย.

## Output จริง เวลารัน status

```
── citation status ──
  ✓ repo root: /opt/Code/github.com/Soul-Brews-Studio/phd-citation-oracle (walk up from the script)
  ✓ 62 paper card(s) in ψ/papers — 61 with a DOI, all citable
  ✓ corpus present (artifacts/literature_corpus.jsonl) — 23814 bytes
  ✓ store ready (…/.citation/store) — 62 paper(s) + 12 vault note(s) · 1024-dim · 296 KB · model ollama:bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified memory — Metal GPU available to ollama
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434 — local, no token, no egress — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU (fully resident — no CPU fallback) · 8192 ctx
```

บรรทัดแรกบอกตรง ๆ ว่า root มาจากกฎไหน — "walk up from the script" คือกฎที่ชนะบนเครื่องนี้. บรรทัดถัดมานับ card จริง ไม่ใช่เลขประมาณ: 62 ใบ 61 ใบมี DOI. Store บอกมิติจริง ขนาดจริง ชื่อโมเดลจริง — ไม่มีตัวเลขไหนในนี้ที่เดาเอา.

จะเปรียบก็เหมือนดาวที่ต้อง fix ตำแหน่งตัวเองให้ชัดก่อน ถึงจะลากเส้นไปหาดาวดวงอื่นได้ถูก — `status` คือขั้นตอนนั้น: ก่อนจะ search หรือ serve อะไรต่อ ระบบต้องรู้ก่อนว่าตัวเองยืนอยู่ตรงไหนของ filesystem.
