## §4 — จาก card ไปเป็น .bib ที่ส่งวิทยานิพนธ์ได้

Card มี `doi:` ในหัวไฟล์แล้วบางส่วน — แต่ half-baked citekey ไม่ใช่ของที่ยื่นให้ advisor ได้ ต้องให้ 62 card ทุกใบมี DOI ก่อน แล้วค่อยแปลงเป็น `.bib` ที่ bibtex คอมไพล์ผ่าน pipeline นี้เดินสองขา: `doi` เติม DOI ที่ยังขาด แล้ว `bib` ค่อยไล่ทุก card แปลงเป็น entry จริง ลำดับสำคัญ — รัน `bib` ก่อน `doi` เสร็จ ได้แค่ half-baked entry ที่ขาด field

```bash
./bin/citation doi --write --all
./bin/citation bib artifacts/citation.bib --by-topic
```

**Dry-run เป็นค่าเริ่มต้น** — เรียก `citation doi` เฉยๆ จะพิมพ์ผลลัพธ์ที่ *จะ* เขียน แต่ไฟล์ไม่ขยับสักบรรทัด นี่คือการซ้อมก่อนแตะของจริง ต้องมี `--write` เท่านั้นถึงจะเขียนกลับเข้า card flags อื่นที่ควบคุมพฤติกรรมได้ละเอียด: `--rekey` แก้ citekey ตาม DOI ที่ถูกต้อง (เผื่อ first-author เดิมผิด citekey ก็ผิดตาม), `--doi X` บังคับ DOI เดี่ยวสำหรับ card เดียว, `--trust-doi` ข้ามการเช็ค title-match เมื่อรู้ DOI แน่ชัดอยู่แล้ว, `--keep-authors` กันไม่ให้ Crossref เขียนทับรายชื่อผู้เขียนเดิมที่มือใส่ไว้เอง หรือจะสั่งเจาะ citekey เดียวก็ได้ ไม่ต้อง `--all` ทุกครั้ง

Crossref เป็นผู้ตัดสิน ไม่ใช่ title-search แบบเดา แต่ title-search เดี่ยวๆ เคยพังมาแล้วสามแบบ แต่ละแบบทิ้งรอยไว้เป็น guard คนละด่าน — ไม่ใช่ทฤษฎี เป็นแผลจริงที่เจอมาก่อนถึงเขียน:

1. **type ต้องเป็น `journal-article`** — เคยมีครั้งหนึ่งที่ title search จัดอันดับ editorial comment ไว้เหนือ paper ที่มันวิจารณ์ ทั้งที่ comment กับ paper คนละชิ้นกัน แถม preprint (`posted-content`) ของ paper เดียวกันยังทำคะแนน title ได้ 1.00 พอๆ กับตัวจริง ถ้าไม่เช็ค type ก่อน คะแนน title สูงสุดก็เอา comment หรือ preprint มาแทนที่ paper จริงได้ง่ายๆ โดยที่ไม่มีใครสังเกต
2. **author agreement ≥ 0.5 ในช่วง title band 0.85–0.95** — แถบนี้อันตรายเป็นพิเศษ เพราะ review paper กับ study ที่มันรีวิว title จะคล้ายกันเกือบสนิท ต่างกันแค่คำสองสามคำ ถ้าเทียบแค่ title อย่างเดียวแยกไม่ออก ต้องดึงรายชื่อผู้เขียนมาเทียบซ้ำอีกชั้นถึงจะรู้ว่าใบไหนคือใบที่ card อ้างถึงจริง
3. **STRONG match** (title ≥ 0.95 + journal ตรง + year ตรง) ถือว่าระบุตัว paper ได้เองแล้ว ไม่ต้องเช็คเพิ่ม — พอเข้าเกณฑ์นี้ก็ปล่อยให้ byline ที่ Crossref บันทึกไว้ overrule สิ่งที่ card เดิมอ้าง เพราะ Crossref คือ registry ต้นทาง ไม่ใช่ AI research report ที่มือสามเขียนมา

กับอีกกติกาหนึ่งที่ไม่ใช่ guard แต่ทำงานคู่กัน — **containment rule**: ถ้าทุกคำใน title เดิมปรากฏอยู่ใน candidate ครบ (precision ≥ 0.95) แปลว่า title เดิมถูก "ตัดหาง" ไว้ ไม่ใช่ paper คนละเรื่อง เคสจริงคือ `bai2022` เข้าเกณฑ์นี้ที่ F1 0.72 — title เดิมในระบบมีแค่ "LGHAP: the Long-term Gap-free High-resolution Air Pollutant concentration dataset" แต่ตัวจริงยาวกว่านั้น มีท่อนหางที่หายไปตั้งแต่แรก ", derived via tensor-flow-based multimodal data fusion" containment rule จับได้ว่านี่คือ paper เดียวกันที่โดนตัดคำตอนบันทึกข้อมูล ไม่ใช่ false match ที่ควรถูก reject

ผลลัพธ์รอบนี้: DOI ไปจาก **8/62 เป็น 61/62** สามด่านบวก containment rule เทียบทุก card กับ Crossref จริง ไม่ใช่แค่เติม DOI ที่หาไม่เจอมาก่อน แต่ยังจับได้ว่า card ไหนอ้างผิดตัวมาตั้งแต่ต้นระหว่างทาง ที่เหลือหนึ่งเดียวที่ยังไม่มี DOI คือ `jarernwong2021` (ตีพิมพ์ใน Chemical Engineering Transactions) ซึ่ง Crossref ไม่ได้ index ไว้เลย ไม่ใช่ index ไว้แต่ match ไม่เจอ — เลือก **ปล่อยไว้แบบไม่มี DOI** ดีกว่าเดา DOI ของ paper อื่นมาใส่มั่วๆ ให้ครบเลข นี่คือ holdout ที่ตั้งใจ เขียนไว้ตรงๆ ไม่ใช่ bug ที่ลืมแก้

พอ DOI ครบ 61/62 แล้ว `citation bib` ถึงไล่ทุก card แปลงเป็น entry ผลคือ `artifacts/citation.bib` — เอาไป validate ด้วย **bibtex จริง** (TeX Live 2026) ไม่ใช่ linter ที่เขียนเอง แล้ว log ออกมาแบบนี้: 62 entries เข้า `.bib`, ได้ 62 `\bibitem` ใน `.bbl` ครบตามจำนวน entry, "warning$ -- 0" ไม่มี warning เหลือเลยสักตัว นี่คือหลักฐานว่า `.bib` compile ผ่านจริง ไม่ใช่แค่ syntax ดูโอเคด้วยตา

รายละเอียดเล็กแต่กัดจริงถ้าพลาด: "et al." ไม่ใช่ name — ถ้าใส่ "et al." ตรงๆ ในฟิลด์ author ของ `.bib` BibTeX จะ parse มันเป็นชื่อคนอีกคนหนึ่ง ทำให้รายชื่อผู้เขียนเพี้ยน generator เลยเขียน `and others` แทนเสมอ ซึ่ง BibTeX รู้จัก keyword นี้อยู่แล้วในตัวมันเอง แล้วปล่อยให้ citation style (เช่น IEEE, APA) เป็นคนแปลง `and others` ให้กลายเป็น "et al." เองตอน render — ผลลัพธ์ที่เห็นบนหน้ากระดาษเหมือนกัน แต่ต้นทางใน `.bib` ถูกต้องตาม spec ส่วน card ไหนที่ไม่มีรายชื่อผู้เขียนให้แปลงเลย จะไม่ถูกทิ้งหายไปจากไฟล์ — ถูกเขียนเป็น **stub ที่ comment ไว้** ใน `.bib` แทน รอวันมีข้อมูลมาเติมค่อยเปิด comment ออก นี่คือหลักการเดียวกับ Principle 1 — Nothing is Deleted แม้แต่ entry ที่ยังไม่พร้อมก็ยังอยู่ในไฟล์ให้เห็น ไม่ใช่หายไปเงียบๆ โดยไม่มีใครรู้ว่าเคยมี
