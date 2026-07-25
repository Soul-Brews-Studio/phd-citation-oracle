# คู่มือคำสั่ง Citation Oracle

**[citation-oracle-commands.pdf](citation-oracle-commands.pdf)** — 61 หน้า · 15 บท · **125 คำสั่ง** · ภาษาไทย

> คำสั่งล้วน ไม่มีอารัมภบท — เปลี่ยนกองเอกสารอ้างอิงให้เป็น `.bib` ที่เชื่อถือได้

เขียนโดย Citation Oracle (เป็น AI — กฎข้อ 6: oracle ไม่แกล้งเป็นคน) · จาก ณัฐ วีระวรรณ์

## เล่มนี้ต่างจากเล่มยาวยังไง

| | เล่มนี้ (คำสั่ง) | [เล่มยาว](../2026-07-25_citation-oracle-complete-manual/) |
|---|---|---|
| หน้า | **61** | 170 |
| คำไทย | ~15,000 | 46,560 |
| code block | **125** | 108 |
| รูปแบบ | คำสั่ง + ตาราง เปิดหาได้ | อธิบายเหตุผล อ่านเรียง |
| เหมาะกับ | ลงมือทำเลย · เปิดหาคำสั่ง | อยากเข้าใจว่าทำไมถึงออกแบบแบบนี้ |

เนื้อหาเดียวกัน 15 บทเหมือนกัน — เล่มนี้ตัด**คำอธิบาย** ออก ~2 ใน 3 แต่ **เพิ่ม**คำสั่ง
(125 เทียบกับ 108) เพราะคนเปิดเล่มนี้มาหาคำสั่ง ไม่ได้มาหาเหตุผล

## โครง

| ภาค | บท | เรื่อง |
|---|---|---|
| — | `00` | **เริ่มที่นี่** — quick start + ตาราง 8 verbs + เส้นทางอ่าน (หน้าเดียว) |
| **1** | 1–5 | ทำอะไรได้/ไม่ได้ · **ติดตั้ง** · ของเสริม · โครงสร้าง + **ตาราง frontmatter 20 field** · **8 verbs reference** |
| **2** | 6–11 | Index: คืออะไร · local (ollama) · CPU · M5 Apple Silicon · cloud · offline/cafe |
| **3** | 12–15 | เขียน brief · ส่งให้ GPT/Gemini · **เอากลับมา + verify** · `.bib` + ตาราง error 18 จุด |

บทที่เปิดหาบ่อยสุด: **05 (8 verbs)** และ **04 (frontmatter 20 field)**

## กฎของเล่มนี้

- **ทุกคำสั่งรันจริงแล้ว** เลขทุกตัวมาจาก output จริง — ไม่มีตัวไหนเดา
- **ตรงไหนยังไม่ได้วัด บอกว่ายังไม่ได้วัด** เช่นเวลา index บนเครื่องไม่มี GPU
  (บทที่ 8 สอนวิธีวัดเอง แทนที่จะเดาตัวเลขให้)
- **ห้ามตัดคำสั่ง** ตอนย่อจากเล่มยาว ตัดได้แค่คำอธิบาย — ตรวจแล้วว่า code block ครบ 125 ก้อน

## Build เอง

```bash
cd ψ/writing/books/2026-07-25_citation-oracle-commands
./build.sh
```

ต้องมี: `pandoc` · `typst` **≥ 0.15.1** · `pdfinfo` (poppler) · `uvx` (PyThaiNLP)

`build.sh` มี gate ทุกขั้น: บทหาย → abort · font fallback → abort (font fallback
ทำให้วรรณยุกต์ไทยเพี้ยนแบบเงียบๆ warning ไม่พอ) · แล้วรายงานว่าจำนวนหน้าเข้าช่วง 54–61 ไหม

## บันทึกเรื่อง layout (ถ้าจะทำเล่มถัดไป)

รอบแรกผมบีบให้ได้ 50 หน้าแล้ว **เละ** — สาเหตุเรียงตามความรุนแรง:

| ทำอะไร | ประหยัด | ผลเสีย |
|---|---|---|
| **ตัด `pagebreak` ตอนขึ้นบทใหม่** | ~8 หน้า | บทใหม่โผล่กลางหน้าต่อท้ายบทเก่า ทั้ง 15 บทชนกัน ← ตัวการหลัก |
| margin 3cm → 1.9cm | ~12% | ตัวหนังสือชิดขอบ |
| body 12pt → 10.5pt | ~10% | ตารางแน่นจนอึดอัด |

เล่มนี้จึงใช้ **stylesheet เดียวกับเล่มยาว** เปลี่ยนแค่ตัวเลข: body 11pt · margin 2.4cm ·
leading 1.34em · code 8pt · **คง `pagebreak` ขึ้นบทใหม่ไว้**

เลขจริงที่วัดได้ตามลำดับ: 47 หน้า (บีบสุด, เละ) → 90 (layout เล่มยาวเป๊ะๆ) →
72 → 69 → 68 → **61** (ตัดคำอธิบาย + ปรับ dial ที่ปลอดภัย)

และคณิตศาสตร์ที่ควรคิดตั้งแต่แรก: **125 code block ≈ 13 หน้า** + **15 pagebreak ≈ 7 หน้า**
= 20 หน้าก่อนจะนับ prose สักคำ — 50 หน้าจึงเป็นไปไม่ได้ถ้าไม่ตัดคำสั่งออก

## Credits

- **Typesetting** — [typst](https://typst.app) · [pandoc](https://pandoc.org) · [poppler](https://poppler.freedesktop.org)
- **Thai NLP** — [PyThaiNLP](https://pythainlp.org) (newmm) ใส่ ZWSP ที่ขอบคำ ข้าม code block
- **Fonts** — Laksaman + Norasi จาก [fonts-tlwg](https://github.com/tlwg/fonts-tlwg) · Fira Code
- **Embeddings** — `bge-m3` (BAAI) ผ่าน [ollama](https://ollama.com)
- **Metadata** — [Crossref](https://www.crossref.org) — ตัวที่จับ error 18 จุดได้
- **เขียนด้วย** — [Claude Code](https://claude.com/claude-code)

Repo: https://github.com/Soul-Brews-Studio/phd-citation-oracle
