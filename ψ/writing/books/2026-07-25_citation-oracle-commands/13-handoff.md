# บทที่ 13: เอาไปให้ GPT / Gemini อ่าน — ส่งออกยังไง

brief จากบทที่แล้ววางใน Gemini Deep Research หรือ GPT ได้เลย แต่ต้องรู้ก่อนว่า tool ทำอะไรไม่ได้ ไม่งั้นได้รายงานผิดหวังกลับมา

## 13.1 สามอย่างที่ deep-research tool ทำไม่ได้

| ทำไม่ได้ | เหตุผล | อย่าขอสิ่งนี้ |
|---|---|---|
| อ่าน paywall | เห็นแค่ title/abstract/DOI ที่ index เปิดให้ | รายละเอียดลึกกว่า abstract — ตาราง, สูตร, ค่าใน supplementary material |
| อ่านไฟล์ในเครื่อง | `ψ/papers/*.md`, corpus JSONL อยู่นอกสายตา tool แม้ repo public | อย่าคิดว่ามันรู้จัก corpus เราเอง — ต้องยกเนื้อหามาวางใน brief เอง |
| รันโค้ด | ไม่มี interpreter มีแต่ข้อความล้วน | "คำนวณตัวเลขใหม่จากข้อมูลดิบ" (เช่น CCC) — มันจะแต่งตัวเลขสมจริงแทนคำตอบว่า "ทำไม่ได้" |

ข้อ paywall ไม่ใช่ "อ่านไม่ได้" แบบเห็นหน้าว่างเปล่า — มันเห็นแค่สิ่งที่ index เปิดให้ รายละเอียดลึกกว่า abstract จะเดาจาก pattern ของ paper แนวเดียวกันแทน แต่หน้าตาคำตอบยังดูมั่นใจเหมือนอ่านจริง

ตัวอย่างข้อสาม — แทนที่จะขอ "คำนวณ CCC ระหว่างเซนเซอร์เรากับ AOD จาก paper นี้" ให้ขอ "หาว่า literature ใช้ metric ไหนวัด agreement ระหว่างเซนเซอร์ราคาถูกกับ reference monitor และ threshold ที่ยอมรับได้" — ตอบได้จากสิ่งที่ paper รายงานไว้แล้ว ไม่ต้องคำนวณใหม่ เพราะ tool ไม่มีทางบอกว่า "ทำไม่ได้"

## 13.2 ดึง context จาก vault ไปด้วย — `search --json`

tool อ่านไฟล์เราไม่ได้ — ต้องดึง context ใส่ brief เอง ไม่งั้นรายงานเสียพื้นที่เล่าซ้ำสิ่งที่ corpus มีอยู่แล้ว

```bash
./bin/citation search "satellite AOD PM2.5" -k 5 --json
```

output จริง (ย่อเหลือฟิลด์ที่ brief ต้องใช้):

```json
[
  {
    "citekey": "bai2021",
    "title": "Bai et al. (2021) -- AOD vs TOA ...",
    "journal": "Aerosol and Air Quality Research (Q2)"
  },
  {
    "citekey": "o2025",
    "title": "O et al. (2025) -- GEMS AOD to ...",
    "journal": "Atmospheric Measurement Techniques (Q1)"
  }
]
```

`citekey` + `title` + `journal` วางเป็น bullet list ในหัวข้อ "สิ่งที่เรารู้แล้ว" ได้ตรงๆ — `id` ที่ store คืนคือ `paper:<citekey>` ไม่ใช่เลขจาก frontmatter (เช่น `2.3.4`) อย่าเอาไปเขียนเป็นเลขอ้างอิง

brief จริงเขียนใน frontmatter ว่า `dedupe: 16 satellite/fusion papers already in artifacts/literature_corpus.jsonl are named in the brief as already-known` แล้วเนื้อ brief ค้ำไว้พอดี:

```
Already known — do NOT spend research effort
re-finding or summarising these: Kim et al.
(2020) GEMS mission, BAMS · Cho et al. (2024)
first GEMS aerosol results, AMT · Jang et al.
(2025) GEMS AOD validation over mainland SE
Asia, AAQR · O et al. (2025) GEMS AOD to hourly
PM2.5 via ML, AMT · ...
```

สิบหกใบนี้คือสิบหกใบที่ tool จะไม่เสียเวลาหาซ้ำ มันหาแต่สิ่งที่ยังไม่มี (MODIS/MAIAC, VIIRS, TROPOMI, Himawari, MISR) — โฟกัสแคบลงเพราะบอกตรงๆ ว่าอะไรมีอยู่แล้ว

`-k` เลือกจำนวนผลลัพธ์ — หัวข้อกว้างต้องตั้งสูง ตั้งต่ำไปตัด paper ที่รู้อยู่แล้วออก tool ก็เสียเวลาหาซ้ำอยู่ดี

## 13.3 สามข้อบังคับที่ต้องเขียนในตัว brief

| ข้อบังคับ | เคสจริงที่ยืนยันว่าจำเป็น |
|---|---|
| flag claim ที่ยืนยันจาก source ไม่ได้ | การ์ด `jang2025` บันทึกว่า "as reported by that synthesis; not yet checked against the paper's own text" |
| DOI ทุกอ้างอิง ห้ามแต่ง | รายงานจริงอ้าง "Chen, X. et al." คู่ DOI `10.3390/rs11232771` — resolve จริงเจอ She, L. et al. (2019) คนละชื่อคนละ title |
| บอกตรงๆ ตอน source ขัดกัน ห้ามเฉลี่ย | Kim(2020)/Cho(2024) บอก "slight" underestimate แต่ Jang(2025) เจอ slope 0.56 ทิศกลับที่ AOD 0.5 |

สองข้อแรกมาจากบรรทัดเดียวกันของ self-check ใน skill `/gemini-deep-research`:

```
Unverifiable claims must be flagged, and
contradictions between sources surfaced rather
than averaged into false consensus.
```

ผลตอนใช้จริง — รายงาน AOD ฉบับเดียวกันตอบกลับมาพร้อมหัวข้อ "Disagreements and Conflicts in the Literature" แยกสองฝั่งไว้ตรงๆ:

```
Foundational algorithm papers (Kim et al., 2020)
and early evaluations (Cho et al., 2024) indicated
only "slight" underestimation. However, the most
recent operational evaluation by Jang et al. (2025)
demonstrates severe, structural underestimation --
slope of just 0.56 -- and this bias reverses at the
extreme low end: GEMS overestimates AOD when AERONET
is below 0.5, but drastically under-reports during
the massive >1.0 AOD spikes typical of March-April
in Thailand.
```

ถ้าเฉลี่ยสองคำอธิบายเป็น "underestimate ปานกลาง" คำตอบจะผิดทั้งสองช่วง — ผิดทิศที่ AOD ต่ำกว่า 0.5 (จริงคือ overestimate) และผิดขนาดที่ AOD สูงกว่า 1.0 ซึ่งเป็นช่วง burning season ที่ thesis ต้องใช้เทียบข้อมูลจริง

รายงานที่เขียนเรียบ น่าเชื่อกว่ารายงานที่เต็มไปด้วย "ไม่แน่ใจ" เสมอ — ถ้าไม่สั่งไว้ก่อน tool จะเลือกทางที่กลบความไม่แน่นอนทิ้งไปเงียบๆ

ข้อ DOI มาจากประโยคนี้ในหัวข้อ source quality ของ brief:

```
Cite every entry with authors, year, full title,
venue, and a DOI or direct URL. Never invent a
DOI or a citation. If you cannot find a DOI, give
the publisher URL and say the DOI could not be
confirmed.
```

เคส Chen X. อันตรายเพราะ DOI นั้น "ถูก" — resolve ไปเจอ paper จริง แต่ชื่อคนกับชื่อเรื่องที่แนบมาไม่ตรงกับ paper ที่ DOI ชี้ไป เช็คแค่ resolve ได้ไม่พอ ต้องเช็ค title กับ author แยกกับ Crossref ด้วย (รายละเอียดเต็มบทที่ 14)

---

brief ที่ทำตามทุกข้อในบทนี้ — บอกข้อจำกัดก่อน ดึง context จาก vault บังคับ flag ที่ยืนยันไม่ได้ บังคับ DOI ห้ามแต่ง บังคับบอกตอน source ขัดกัน — ก็ยังไม่ได้แปลว่ารายงานที่ได้กลับมาจะถูกทั้งหมด

brief คุมได้แค่สิ่งที่ *ขอ* ไม่ได้คุมสิ่งที่ *ได้กลับมาจริง* — tool ทำตามกฎครบทุกข้อแล้วยังแต่งชื่อ paper ผิดได้อยู่ดี วางไว้ข้าง DOI ที่ถูกต้อง 100% จนตรวจด้วยตาเปล่าไม่เจอ (เคส Chen X. ข้างบน) ของที่ได้จาก Gemini หรือ GPT เชื่อไม่ได้ทั้งหมดจนกว่าจะผ่านการตรวจอีกรอบ — บทที่ 14 พาไปดูว่าตรวจยังไง

เก็บ brief ที่เขียนเสร็จไว้ที่ `ψ/writing/prompts/<YYYY-MM-DD>_<slug>_gemini-deep-research.md` — reuse โครงเดิมกับหัวข้อถัดไปได้เลย
