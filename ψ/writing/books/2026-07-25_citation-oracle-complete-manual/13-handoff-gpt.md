# บทที่ 13: เอาไปให้ GPT / Gemini อ่าน — ส่งออกยังไง

บทที่แล้วเขียน brief จนจบ พร้อมวางใน Gemini Deep Research หรือ
เครื่องมือแบบเดียวกันของ GPT ได้เลย แต่ก่อนวาง ต้องรู้ก่อนว่ามัน
ทำอะไรไม่ได้ — เพราะ brief ที่ขอในสิ่งที่ tool ไม่มีทางให้ได้ ต่อให้
เขียนดีแค่ไหน ก็ยังได้รายงานที่ผิดหวังกลับมาเหมือนเดิม

กฎของบทนี้ตรงไปตรงมา บอกข้อจำกัดก่อน แล้วค่อยบอกวิธีใช้ให้คุ้ม
กับข้อจำกัดนั้น ไม่ใช่โฆษณาความสามารถก่อน แล้วค่อยแอบซ่อนสิ่งที่
มันทำไม่ได้ไว้ท้ายบท

## 13.1 ข้อจำกัดจริงของ deep-research tool

สามอย่างที่ deep-research tool ทำไม่ได้ ไม่ว่าจะเป็น Gemini หรือ
GPT หรือตัวไหนก็ตาม

- **อ่าน full text ที่อยู่หลัง paywall ไม่ได้**
- **อ่านไฟล์ในเครื่องเราไม่ได้**
- **รันโค้ดไม่ได้**

ข้อแรก — paywall — ต้องแยกให้ชัดว่ามันไม่ได้ "อ่านไม่ได้" แบบเห็น
หน้าว่างเปล่า มันเห็นสิ่งที่ index สาธารณะเปิดให้เห็น ซึ่งมักจะเป็น
title, abstract, keyword, บางทีก็แค่ metadata ระดับ DOI เฉยๆ โดย
ไม่มี full text แนบมาเลย ผลคือรายงานที่ได้จะอ้างอิง paper ได้ถูก
ตัว แต่รายละเอียดที่อยู่ลึกกว่า abstract — ตาราง, สูตร, ค่าที่ซ่อน
อยู่ใน supplementary material — tool ไม่มีทางรู้ได้เลย ถ้าถามลึก
กว่านั้น มันจะเดาจาก pattern ทั่วไปของ paper แนวเดียวกันแทน โดย
ที่หน้าตาคำตอบยังดูมั่นใจเหมือนอ่านจริงทุกประการ

ข้อสอง — ไฟล์ในเครื่องเรา — `ψ/papers/*.md` ทั้งชุด corpus JSONL
การ์ดที่เขียนเองใน vault อยู่ในเครื่องเรา (หรือ git ของเรา) ไม่ใช่
สิ่งที่ tool เปิดดูเองได้ ต่อให้ repo ตั้งเป็น public มันก็ยังไม่ไป
browse repo ให้เราเอง ไม่ต่างจากคนอื่นที่ไม่มี URL ตรงมาป้อนให้ —
มันไม่รู้ว่า repo นี้มีอยู่ด้วยซ้ำ จนกว่าเราจะเป็นคนยกเนื้อหามาวาง
เองในตัว brief

ข้อสาม — รันโค้ดไม่ได้ — สำคัญที่สุดเพราะเป็นข้อที่คนขอผิดบ่อยสุด
deep-research tool ไม่มี interpreter ต่อท้ายให้เรียกใช้ ต่างจาก
chat ทั่วไปที่บางตัวมี code sandbox แนบมาด้วย มันเขียนได้แค่ข้อความ
ล้วนๆ พอถามคำถามที่ต้องการให้ *คำนวณตัวเลขใหม่จากข้อมูลดิบ* มันจะ
ไม่มีทางบอกว่า "ทำไม่ได้" ตรงๆ — มันจะแต่งตัวเลขที่ฟังดูสมเหตุสมผล
ออกมาแทน เพราะภาษาที่มันฝึกมาคือภาษาที่ต้อง "ตอบให้ได้" เสมอ

ตัวอย่างที่ชัดที่สุดคือ CCC (concordance correlation coefficient)
— ถ้าถามว่า "คำนวณ CCC ระหว่างค่าที่เซนเซอร์ของเราวัดได้ กับค่า
AOD จาก paper นี้" คำตอบที่ได้จะเป็นตัวเลขที่ไม่มีทางตรวจสอบย้อน
กลับได้เลยว่ามาจากไหน เพราะไม่มี dataset จริงสองชุดถูกป้อนเข้าไป
คำนวณจริงๆ สักครั้ง มันแค่รู้ว่า CCC มักอยู่ในช่วงไหนสำหรับงานแนว
นี้ แล้วโยนตัวเลขที่ "ดูสมจริง" มาให้

คำถามที่ถูกต้องต้องเปลี่ยนมุม จาก "คำนวณให้ใหม่" เป็น "หาว่างาน
ที่ตีพิมพ์แล้วใช้ metric ตัวไหนวัดความสอดคล้อง" — เช่นแทนที่จะขอ
"คำนวณ CCC จากข้อมูลนี้" ให้ขอ "หาว่า metric ไหนที่ literature ใช้
วัด agreement ระหว่างเซนเซอร์ราคาถูกกับ reference monitor และ
threshold ที่ถือว่ายอมรับได้อยู่ที่เท่าไหร่" — คำถามแบบหลังนี้ตอบ
ได้จากสิ่งที่ paper รายงานไว้แล้วจริง ไม่ต้องคำนวณอะไรใหม่เลย

| ทำไม่ได้ | เหตุผล | ต้องเขียนใน brief ยังไง |
|---|---|---|
| อ่าน paywall | เห็นแค่ metadata สาธารณะ | ขอเฉพาะสิ่งที่ยืนยันจาก source เปิดได้ |
| อ่านไฟล์เครื่องเรา | vault อยู่นอกสายตา tool | ยกสิ่งที่รู้แล้วไปวางในตัว brief เอง |
| รันโค้ด | ไม่มี interpreter | ขอ "ตัวเลขที่รายงานไว้" ไม่ใช่ "คำนวณใหม่" |

สามบรรทัดนี้คือเหตุผลที่หัวข้อถัดไปกับสองหัวข้อหลังจากนั้นเขียนออก
มาแบบนี้ — แต่ละข้อบังคับในบทนี้ตอบข้อจำกัดข้อใดข้อหนึ่งในตาราง
ตรงๆ ไม่มีข้อไหนตั้งขึ้นมาลอยๆ

## 13.2 เอา context จาก vault ไปด้วยยังไง — `search --json`

พอ tool อ่านไฟล์ในเครื่องเราไม่ได้ ก็ต้องเป็นเราเองที่ดึงสิ่งที่รู้
อยู่แล้วออกมาใส่ใน brief แทน ไม่งั้นรายงานที่ได้กลับมาจะเสียพื้นที่
ไปเล่าสิ่งที่ corpus เรามีอยู่แล้วซ้ำ — "สิ่งที่เรารู้แล้ว" ทำให้
รายงานไม่เสียไปหนึ่งในสามกับการทวนสิ่งที่เรารู้อยู่แล้ว

`./bin/citation search` มี flag `--json` รองรับอยู่แล้ว ใช้ดึง
context ออกมาได้ตรงๆ โดยไม่ต้องเปิด `maw` เลยด้วยซ้ำ

```bash
./bin/citation search "satellite AOD PM2.5" -k 5 --json
```

output เป็น array ของ object แต่ละใบมีฟิลด์พร้อมใช้ทันที นี่คือ
ผลจริงที่รันได้ตอนเขียนบทนี้ ไม่ใช่ตัวอย่างสมมติ

```json
[
  {
    "similarity": 0.7162,
    "kind": "paper",
    "citekey": "bai2021",
    "id": "paper:bai2021",
    "title": "Bai et al. (2021) -- AOD vs TOA Reflectance for PM2.5",
    "journal": "Aerosol and Air Quality Research (Q2)",
    "topic": "satellite-pm25-products",
    "path": "ψ/papers/bai2021.md"
  },
  {
    "similarity": 0.7058,
    "kind": "paper",
    "citekey": "o2025",
    "id": "paper:o2025",
    "title": "O et al. (2025) -- GEMS AOD to Hourly PM2.5 via ML",
    "journal": "Atmospheric Measurement Techniques (Q1)",
    "topic": "satellite-pm25-products",
    "path": "ψ/papers/o2025.md"
  }
]
```

สามฟิลด์ `citekey`, `title`, `journal` พอดีกับสิ่งที่ brief ต้องการ
ในหัวข้อ context อยู่แล้ว ไม่ต้องนั่งเขียนรายชื่อ paper ทวนความจำ
เอง เอา JSON มา grep สามฟิลด์นั้น วางเป็น bullet list ต่อท้ายในหัวข้อ
"สิ่งที่เรารู้แล้ว" ของ brief จบ

สังเกตด้วยว่า `id` ในผลลัพธ์จริงคือ `paper:<citekey>` ไม่ใช่เลขจาก
frontmatter ของการ์ด (เช่น `2.3.4`) — สองอย่างนี้คือคนละฟิลด์กัน
ฟิลด์ `id` ที่ search คืนมาคือ id ภายในของ store เอง ใช้แยกรายการ
ในผลลัพธ์ ไม่ใช่เลขอ้างอิงที่จะเอาไปเขียนลง brief

brief จริงที่เคยใช้ (`ψ/writing/prompts/2026-07-25_satellite-aod
-pm25-products_gemini-deep-research.md`) มี frontmatter บันทึกไว้
ตรงๆ ว่า `dedupe: 16 satellite/fusion papers already in artifacts
/literature_corpus.jsonl are named in the brief as already-known`
— หนึ่งบรรทัดจำไว้ว่าตอนเขียน brief ครั้งนั้น ดึงอะไรมากันซ้ำแล้ว
บ้าง

แล้วในเนื้อ brief เองก็มีหัวข้อ "Context to assume" ค้ำไว้ ตรงกับ
บรรทัดใน frontmatter พอดี

```
Already known — do NOT spend research effort
re-finding or summarising these, they are already
catalogued. Cite them only where needed for
comparison: Kim et al. (2020) GEMS mission, BAMS ·
Cho et al. (2024) first GEMS aerosol results, AMT ·
Jang et al. (2025) GEMS AOD validation over mainland
SE Asia, AAQR · O et al. (2025) GEMS AOD to hourly
PM2.5 via ML, AMT · ...
```

สิบหกใบที่ list ไว้แบบนี้คือสิบหกใบที่ deep-research tool จะไม่ไป
เสียเวลาหาซ้ำ มันไปหาแต่สิ่งที่เรายังไม่มี (กรณีนี้คือ MODIS/MAIAC,
VIIRS, TROPOMI, Himawari, MISR) โฟกัสของรายงานแคบลงจริง ไม่ใช่
เพราะขอให้แคบ แต่เพราะบอกไปตรงๆ ว่าอะไรมีอยู่แล้ว

`-k` เลือกจำนวนผลลัพธ์เอง ยิ่งหัวข้อกว้าง ยิ่งต้องตั้งเลขสูงหน่อย —
ถ้าตั้งต่ำไปจนตัด paper ที่เกี่ยวข้องออกไป brief ก็จะพลาดบอกว่ามัน
"รู้แล้ว" ทั้งที่จริงรู้อยู่ แล้ว tool ก็ไปเสียเวลาหาซ้ำอยู่ดี ไม่ต่าง
จากไม่ดึง context มาเลยตั้งแต่แรก

สามข้อบังคับที่ต้องเขียนลงในตัว brief เองด้วย ไม่ใช่แค่หัวข้อ
context อย่างเดียว — สามหัวข้อถัดไปพาไปดูทีละข้อ พร้อมของจริง

## 13.3 บอกให้มัน flag สิ่งที่ยืนยันไม่ได้ แทนที่จะเกลี่ยให้เรียบ

deep-research tool อ่านหลายร้อยหน้าได้จริง แต่พอถึงเวลาสรุป มันมี
นิสัยหนึ่งที่อันตราย — เขียนให้ดูเรียบเนียน แม้หลักฐานข้างใต้จะไม่
เรียบเลยก็ตาม ตัวเลข R² สองค่าจากสอง paper ที่วัดกันคนละเงื่อนไข
ถ้าไม่สั่งไว้ก่อน มันจะเอามาวางเทียบกันเฉยๆ เหมือนเทียบกันได้ตรงๆ

สองกฎที่ต้องเขียนไว้คู่กันใน brief มาจากบรรทัดเดียวกันของ
self-check ใน skill `/gemini-deep-research`

> Unverifiable claims must be flagged, and
> contradictions between sources surfaced rather
> than averaged into false consensus.

ข้อแรก — claim ไหนยืนยันจาก source หลักไม่ได้ ต้อง flag ไว้ ไม่ใช่
เขียนกลบให้ดูเหมือนยืนยันแล้ว brief จริงเขียนไว้ในส่วน "Rules"
ตรงๆ ว่า "Flag every claim you could not confirm from a primary
or authoritative source"

ข้อสอง — ตอน source สองสามแหล่งขัดกันเอง ห้ามเฉลี่ยเป็นข้อสรุป
กลางๆ ที่ไม่มี paper ไหนพูดจริง ต้องเขียนทั้งสองฝั่งไว้ แล้วบอกว่า
ฝั่งไหนมีหลักฐานหนักกว่า พร้อมเหตุผล — ประโยคในกฎเดียวกันเขียนไว้
ว่า "Where sources conflict, present both positions and say which
is better supported, and why"

ข้อนี้ไม่ใช่กฎลอยๆ ที่ไม่เคยพิสูจน์ว่าใช้ได้จริง — รายงาน AOD
ฉบับเดียวกับที่ยกมาข้างบน ตอบกลับมาพร้อมหัวข้อ "Disagreements and
Conflicts in the Literature" หัวข้อย่อย "Direction and Magnitude
of GEMS Bias" เขียนไว้ตรงๆ ว่า

> Foundational algorithm papers (e.g., Kim et al.,
> 2020) and early post-launch evaluations (e.g., Cho
> et al., 2024) indicated high temporal correlation
> with AERONET and projected only "slight"
> underestimation. However, the most recent direct
> operational evaluation ... by Jang et al. (2025)
> demonstrates a severe, structural underestimation
> ... Jang reports a linear regression slope of just
> 0.56 ... Notably, this bias reverses at the extreme
> low end: GEMS overestimates AOD when AERONET is
> below 0.5, but drastically under-reports during the
> massive >1.0 AOD spikes typical of March and April
> in Thailand.

นี่คือสิ่งที่เกิดขึ้นจริงเมื่อบอกไว้ในกฎ — แทนที่จะได้ประโยคเดียว
กลางๆ แบบ "GEMS มีแนวโน้ม underestimate AOD เล็กน้อย" ซึ่งจะผิดทั้ง
สองด้าน ได้รายงานที่แยกให้เห็นว่า Kim/Cho พูดถึง bias ระดับ
"slight" จาก mission เริ่มต้น ส่วน Jang วัดจริงในพื้นที่แล้วเจอ
slope 0.56 พร้อมทิศทางที่กลับกันเองตรงจุด AOD ต่ำกับ AOD สูง

ทำไมถึงเฉลี่ยไม่ได้เลย — ถ้าเอาสองคำอธิบายนี้มาผสมเป็นคำเดียวว่า
"underestimate ปานกลาง" คำตอบที่ได้จะผิดทั้งสองช่วง ผิดทิศทางเลย
ตรงช่วง AOD ต่ำกว่า 0.5 (ที่จริง GEMS overestimate ไม่ใช่
underestimate) และผิดขนาดตรงช่วง AOD สูงกว่า 1.0 ที่ underestimate
รุนแรงกว่าคำว่า "ปานกลาง" มาก — ช่วงหลังนี้คือช่วง burning season
ตัวจริงที่ thesis ต้องใช้เทียบข้อมูลด้วย ผิดตรงนี้คือผิดตรงจุดที่
สำคัญที่สุด

ต้องพูดตรงๆ ด้วยว่า ตัวเลข slope 0.56 กับจุดกลับทิศที่ AOD 0.5 นี้
ยังเป็นสิ่งที่ "รายงานบอกไว้" เท่านั้น การ์ด `jang2025` เองก็บันทึก
ไว้ชัดว่า "as reported by that synthesis; not yet checked against
the paper's own text" — brief คุมได้แค่ให้มัน *แสดงความขัดแย้ง*
ออกมาให้เห็น ส่วนตัวเลขที่แสดงนั้นถูกจริงรึเปล่ายังต้องผ่านอีก
ขั้นตอนหนึ่ง ซึ่งเป็นเรื่องของบทที่ 14

ทำไมสองข้อนี้ถึงสำคัญกว่าที่คิด เพราะรายงานที่เขียนเรียบ อ่านลื่น
น่าเชื่อกว่ารายงานที่เต็มไปด้วยคำว่า "ไม่แน่ใจ" หรือ "ขัดแย้งกัน"
เสมอ ถ้าไม่สั่งไว้ก่อน tool จะเลือกทางที่อ่านง่ายกว่า ซึ่งคือทางที่
กลบความไม่แน่นอนทิ้งไปเงียบๆ

## 13.4 บังคับให้ใส่ DOI/URL ทุกอ้างอิง และห้ามแต่ง

ข้อบังคับข้อที่สามคุมเรื่องอ้างอิงตรงๆ ทุกรายการที่ยกมาอ้างต้องมี
DOI หรือ URL ต่อท้ายเสมอ ถ้าหาไม่เจอให้บอกว่าหาไม่เจอ ห้ามแต่ง
ขึ้นมาเติมช่องว่างให้ครบ

ประโยคจาก brief จริง เขียนไว้ในหัวข้อ source quality ตรงๆ ว่า

> Cite every entry with authors, year, full title,
> venue, and a DOI or direct URL. Never invent a
> DOI or a citation. If you cannot find a DOI, give
> the publisher URL and say the DOI could not be
> confirmed.

สังเกตว่ากฎนี้ไม่ได้ขอแค่ "ใส่ DOI" เฉยๆ มันขอทางออกเมื่อหาไม่
เจอไว้ด้วย — "give the publisher URL and say the DOI could not be
confirmed" เพราะถ้าไม่มีทางออกให้ tool ที่ต้องส่งมอบผลงานให้ครบ
ทุกช่อง มันจะเลือกแต่งเอาดื้อๆ แทนการเว้นว่างไว้

ทำไมข้อนี้ถึงต้องเขียนไว้ชัดขนาดนี้ เพราะสิ่งที่ deep-research tool
แต่งขึ้นมาได้ ไม่ใช่แค่ข้อความเลื่อนลอยกลางๆ มันแต่งได้ถึงระดับ
ชื่อผู้เขียนกับชื่อ paper เต็มรูปแบบ อ่านแล้วดูน่าเชื่อไม่ต่างจากของ
จริงเลยสักนิด

รายงาน AOD ฉบับเดียวกันนี้เองเป็นตัวอย่างจริง — มันอ้างถึง
"Chen, X. et al. — Validation of GeoNEX Himawari-8 MAIAC Aerosol
Optical Depth" พร้อม DOI `10.3390/rs11232771` วางไว้ข้างๆ อย่าง
มั่นใจ แต่ DOI ตัวนั้นเมื่อเช็คกับ Crossref จริง กลับนำไปสู่ paper
คนละใบเลย — She, L. et al. (2019) "Evaluation of the Multi-Angle
Implementation of Atmospheric Correction (MAIAC) Aerosol Algorithm
for Himawari-8 Data" ทั้งชื่อผู้เขียนและชื่อ paper ผิดพร้อมกัน
ทั้งคู่ ไม่มี "Chen, X." คนนี้อยู่จริงในวรรณกรรมเรื่องนี้เลย

ประเด็นสำคัญคือ DOI นั้น "ถูก" ในแง่ที่ resolve ไปเจอ paper จริง
ใบหนึ่ง — สิ่งที่ผิดคือ metadata ที่แนบมาด้วย (ชื่อคน, ชื่อเรื่อง)
ไม่ตรงกับ paper ที่ DOI นั้นชี้ไป นี่คือรูปแบบการแต่งที่อันตราย
ที่สุด เพราะเช็คแค่ว่า "DOI resolve ได้มั้ย" ไม่พอ ต้องเช็ค title
กับ author ทุกตัวแยกกับสิ่งที่ Crossref คืนมาด้วย — รายละเอียด
เต็มของเคสนี้ พร้อมอีกสี่เคสจากรายงานฉบับเดียวกัน รออยู่ในบทที่ 14

## 13.5 ตั้งชื่อ output sections ไว้ล่วงหน้า — ตรวจ plan ได้ใน 10 วินาที

Gemini Deep Research ไม่เริ่มค้นทันทีที่วาง brief — มันสร้าง
"plan" เป็นรายการขั้นตอนก่อน แล้วรอให้เรากดอนุมัติ นี่คือจุดคุ้ม
ที่สุดในกระบวนการทั้งหมด เพราะแก้ plan ตอนนี้เสียเวลาไม่กี่วินาที
ต่างจากปล่อยให้มันรันไปสิบนาทีแล้วค่อยพบว่าหลงประเด็น

ตัว brief ต้องตั้งชื่อหัวข้อผลลัพธ์ที่ต้องการไว้ล่วงหน้าให้ชัดใน
ส่วน "What to produce" brief จริงตั้งไว้เจ็ดหัวข้อตายตัว ไม่ใช่
แค่บอกว่า "สรุปมาให้หน่อย" กว้างๆ

```
1. Direct answer to the objective
2. Annotated bibliography grouped by product
3. Comparison table
4. Where the sources disagree
5. What could not be verified
6. Gaps: which products have no validation at all
7. Full reference list
```

พอชื่อหัวข้อตายตัวแบบนี้ plan ที่ Gemini ส่งกลับมาก่อนรัน มักจะมี
ขั้นตอนที่สะท้อนหัวเรื่องพวกนี้ตรงๆ — ตรวจแค่ scan ชื่อหัวข้อใน
plan เทียบกับ list ทั้งเจ็ดข้อที่เขียนไว้ ถ้าข้อไหนหายไปเลยตั้งแต่
plan รู้ได้ทันทีก่อนเสียเวลารันจริง ไม่ต้องอ่านทุกบรรทัดในพารากราฟ
ของ plan ก็เช็คได้ครบ นี่คือที่มาของคำว่า "10 วินาที" — งานคือจับคู่
หัวข้อ ไม่ใช่อ่านทำความเข้าใจ

ไฟล์ brief จริง `2026-07-25_satellite-aod-pm25-products_gemini
-deep-research.md` เขียนขั้นตอนการรันไว้ท้ายไฟล์ ตรงกับหลักการนี้
เป๊ะ

> Read the generated plan and edit it before
> approving — check that no step has wandered into
> China-only validation or into forecasting, and
> that the four verification targets each appear as
> their own step.

สังเกตว่าคำสั่งนี้เจาะจงมาก ไม่ใช่ "ดู plan ผ่านๆ" — มันบอกตรงๆ ว่า
ต้องเช็คอะไรสองอย่าง หนึ่งคือไม่มีขั้นตอนไหนหลุดออกนอก scope (เช่น
ไปวนอยู่กับข้อมูลจากจีนเท่านั้น ทั้งที่ brief ตั้ง scope ไว้ที่
mainland Southeast Asia) สองคือสี่ข้อใน "Specific things to
verify" ต้องมีขั้นตอนของตัวเองแยกกันในแต่ละข้อ ไม่ใช่ถูกยำรวมเป็น
ขั้นตอนเดียวกำกวมๆ

หลักการเดียวกันนี้ใช้ได้กับทั้งสองส่วนของ brief พร้อมกัน — ทั้ง
"What to produce" (เจ็ดหัวข้อ) และ "Specific things to verify"
(สี่ข้อ) ยิ่งตั้งชื่อไว้ชัดเจนตายตัวแค่ไหน plan ที่ส่งกลับมาก็ยิ่ง
ตรวจง่ายแค่นั้น เพราะกลายเป็นงานจับคู่รายการ ไม่ใช่งานอ่านจับใจ
ความ

## 13.6 เก็บ brief ไว้ใน repo — reusable กับหัวข้ออื่น

พอเขียน brief เสร็จ อย่าทิ้งไว้ในหน้าต่างแชทที่จะหายไปเมื่อ session
จบ เก็บลงไฟล์ในระบบไปเลย ของเราคือ `ψ/writing/prompts/<YYYY-MM
-DD>_<slug>_gemini-deep-research.md` — ไฟล์จริงที่ยกมาอ้างทั้งบทนี้
ก็เก็บไว้แบบนี้เหมือนกัน

frontmatter ของไฟล์บันทึกไว้มากกว่าแค่ตัว brief เอง มันจำ scoping
ที่ตอบไว้ตอนต้นด้วย

```yaml
title: Satellite aerosol/AOD products for PM2.5
  over mainland SE Asia
date: 2026-07-25
tool: Google Gemini Deep Research
skill: gemini-deep-research
scoping:
  purpose: Compare satellite products
  geography: Northern Thailand + mainland SE Asia
  deliverable: Annotated bibliography
  recency: 2021-2026 + foundational
```

เหตุผลที่เก็บละเอียดขนาดนี้ — โครงของ brief (objective ผูกกับการ
ตัดสินใจ, context, scope, source quality, สิ่งที่ต้อง verify, output
sections, rules) ไม่เปลี่ยนไปตามหัวข้อ สิ่งที่เปลี่ยนคือเนื้อในแต่ละ
ช่องเท่านั้น พอมี brief เก่าเก็บไว้ ครั้งหน้าที่ต้องรีเสิร์ชหัวข้อใหม่
ไม่ต้องเริ่มจากศูนย์อีกรอบ — สลับหัวข้อ สลับ scope ใส่ของใหม่เข้า
ไปในโครงเดิม เร็วกว่าคิดเองใหม่ทั้งชุดมาก

skill เองก็เขียนหลักการนี้ไว้ตรงๆ ว่า "briefs are highly reusable
with the topic swapped" ไม่ใช่แค่เก็บไว้เผื่อจำ แต่เก็บไว้เพราะใช้
ซ้ำได้จริง — หัวข้อ output sections ที่ตั้งไว้ในหัวข้อ 13.5 ก็เป็น
ส่วนหนึ่งของโครงที่ reuse ได้เช่นกัน แค่เปลี่ยนชื่อ product เปลี่ยน
ภูมิภาค โครงเจ็ดหัวข้อยังใช้ซ้ำได้ทั้งอัน

git เก็บ history ของ brief แต่ละไฟล์ไว้ด้วย ถ้าแก้ brief รอบสอง
แล้วอยากย้อนดูว่ารอบแรกเขียนไว้ยังไง เปิด `git log` ดูได้เสมอ ไม่มี
อะไรถูกลบทิ้งไปพร้อมกับ session แชทที่ปิดไปแล้ว

---

brief ที่ทำตามทุกข้อในบทนี้ — บอกข้อจำกัดไว้ก่อน ดึง context จาก
vault มาด้วย บังคับ flag ของที่ยืนยันไม่ได้ บังคับ DOI ห้ามแต่ง
บังคับบอกตอน source ขัดกัน ตั้งชื่อ output section ไว้ล่วงหน้า —
ก็ยังไม่ได้แปลว่ารายงานที่ได้กลับมาจะถูกทั้งหมด

brief คุมได้แค่สิ่งที่ *ขอ* ไม่ได้คุมสิ่งที่ *ได้กลับมาจริง* — tool
ทำตามกฎทุกข้อที่สั่งไว้ได้ครบ แล้วยังแต่งชื่อ paper ผิดไปทั้งใบได้
อยู่ดี วางไว้ข้าง DOI ที่ถูกต้อง 100% จนตรวจด้วยตาเปล่าไม่เจอ อย่าง
เคส Chen, X. ในหัวข้อ 13.4 นั่นเอง

เพราะงั้นของที่ได้กลับมาจาก Gemini หรือ GPT ทุกคำ เชื่อไม่ได้
ทั้งหมด จนกว่าจะผ่านการตรวจอีกรอบหนึ่ง บทหน้าจะพาไปดูว่าการ
ตรวจรอบนั้นทำยังไง แล้วมันเจออะไรเข้าจริงๆ กับ corpus ใบนี้
