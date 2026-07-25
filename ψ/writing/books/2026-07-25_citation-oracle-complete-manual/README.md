# คู่มือ Citation Oracle ฉบับสมบูรณ์

**[citation-oracle-complete-manual.pdf](citation-oracle-complete-manual.pdf)** — 15 บท ภาษาไทย

> จาก paper 62 ใบ ไปเป็น `.bib` ที่ส่งวิทยานิพนธ์ได้ — ทุกเครื่อง ทุกที่ ทุกงบ

เขียนโดย Citation Oracle (เป็น AI — กฎข้อ 6: oracle ไม่แกล้งเป็นคน) · จาก ณัฐ วีระวรรณ์
25 กรกฎาคม 2026

## โครง 3 ภาค

| ภาค | บท | เรื่อง |
|---|---|---|
| **1 — เตรียมตัว** | 1–5 | บทเตรียมตัว · เตรียมของ · ลงอุปกรณ์เพิ่มเติม · โครงสร้าง · วิธีใช้งาน |
| **2 — Index ทุกแบบ** | 6–11 | Index คืออะไร · Local (ollama) · CPU · M5 Apple Silicon · Cloud · Cafe Mode |
| **3 — วงจร Research** | 12–15 | ทำ brief · ส่งให้ GPT/Gemini · เอากลับมา + verify · `.bib` กับบทเรียน 18 ข้อ |

**อ่านตรงไหนก่อน:** อยากเริ่มใช้เลย → บท 2 กับ 5 · สนใจกลไกข้างใน → บท 6 ·
จะทำ research → ข้ามไปภาค 3 ได้เลย

## กฎของเล่มนี้

**ทุกคำสั่งในเล่มรันจริงแล้ว** เลขทุกตัวมาจาก output จริงบนเครื่อง m5 (Apple M5 Max, arm64,
18 cores, 128 GB unified memory) — และตรงไหนที่ **ยังไม่ได้วัด** ก็บอกว่ายังไม่ได้วัด
(เช่นเวลา index บนเครื่องที่ไม่มี GPU — บทที่ 8 สอนวิธีวัดเอง แทนที่จะเดาตัวเลขให้)

บทที่ 15 เล่าที่ oracle ทำผิดเองด้วย ไม่ใช่แค่ที่ข้อมูลผิด — นับ error ตัวเองผิดใน commit message
และบอกว่า "แก้แล้ว" ตอนที่เทสผ่าน pipe ซึ่งไม่เคยแตะ TTY จริง

## Build เอง

```bash
cd ψ/writing/books/2026-07-25_citation-oracle-complete-manual
./build.sh
```

ต้องมี: `pandoc` · `typst` **≥ 0.15.1** · `pdfinfo` (poppler) · `uvx` (สำหรับ PyThaiNLP)

| ไฟล์ | ทำอะไร |
|---|---|
| `OUTLINE.md` | โครงทั้งเล่ม — metadata ต่อบท, proof ที่ต้องอ้าง, checklist |
| `NN-*.md` | ต้นฉบับแต่ละบท (source of truth) |
| `book.typ` | styling — font ที่ pin ไว้, layout, สี, ตาราง |
| `thai-wordbreak.py` | ใส่ ZWSP ที่ขอบคำไทย ข้าม code block กับ inline code |
| `build.sh` | assemble → wordbreak → pandoc → typst → PDF (มี gate ทุกขั้น) |
| `fonts/` | Laksaman + Norasi vendored ไว้ ให้ build ซ้ำได้เหมือนเดิม |

### สองอย่างที่ต้องระวังตอน build

**typst ต้อง ≥ 0.15.1** — 0.14.x วางวรรณยุกต์ไทยเพี้ยน (ไม้เอก สระบน ลอยหลุด)

**ต้อง pin font และ `--font-path fonts`** — `pandoc -t typst` ไม่ปล่อย `#set text(font:)`
ออกมาเลย ถ้าไม่ pin typst จะ fallback ไป default ที่ไม่มีไทย แล้วมาร์กจะเพี้ยนแบบ**เงียบๆ**
`build.sh` เลย gate ที่คำว่า `unknown font` — เจอแล้ว exit ทันที ไม่ปล่อยให้ได้ PDF ที่ผิด

Font ที่ vendored ไว้เป็น `.ttf` แยกน้ำหนัก (ไม่ใช่ `.ttc` collection ที่บางทีเลือกหน้าผิด)

**ไม่ justify** — typst justify ด้วยการยืดช่องว่าง แต่คำไทยเชื่อมกันด้วย ZWSP ซึ่งยืดไม่ได้
justify แล้วจะได้ river กลางหน้า ใช้ ragged-right ถูกกว่า

## Credits

- **Typesetting** — [typst](https://typst.app) · [pandoc](https://pandoc.org) · [poppler](https://poppler.freedesktop.org)
- **Thai NLP** — [PyThaiNLP](https://pythainlp.org) (newmm tokenizer) สำหรับตัดคำใส่ ZWSP
- **Fonts** — Laksaman + Norasi จาก [fonts-tlwg](https://github.com/tlwg/fonts-tlwg) (Thai Linux Working Group) · Fira Code สำหรับ code
- **Embeddings** — `bge-m3` (BAAI) รันผ่าน [ollama](https://ollama.com) บนเครื่อง
- **Metadata** — [Crossref](https://www.crossref.org) — ตัวที่จับ error ทั้ง 18 จุดได้
- **เขียนด้วย** — [Claude Code](https://claude.com/claude-code) · skill `/oracle-write-complete-book`

Repo: https://github.com/Soul-Brews-Studio/phd-citation-oracle
