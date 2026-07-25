# บทที่ 14: เอากลับมาทำยังไง — ingest แล้วต้อง verify

บทนี้ให้: ลำดับ ingest 5 ขั้นห้ามสลับ, คำสั่ง verify DOI กับ
Crossref, ตาราง 5 เคสจริงที่ AI แต่งข้อมูล (จับได้จากรายงานฉบับ
เดียว), คำสั่ง `citation doi --write`

## 14.1 ลำดับ ingest — 5 ขั้นห้ามสลับ

`skill /research-ingest` บังคับลำดับนี้:

| ขั้น | ทำอะไร | เครื่องมือ / เกณฑ์ |
|---|---|---|
| 1. เก็บดิบ | เก็บรายงานต้นฉบับ verbatim + provenance | ไฟล์ต้นฉบับแก้ไม่ได้ แก้ทั้งหมดไปอยู่ `## Review` ต่อท้าย |
| 2. verify DOI | เช็คทุก DOI กับ Crossref **ก่อน**แตะการ์ด | curl + Crossref API — ห้ามข้าม |
| 3. reconcile | เลือก enrich / create / hold ต่อรายการ | เทียบกับการ์ดเดิมทีละใบ |
| 4. index | embed เข้า store | `maw citation index --vault` |
| 5. พิสูจน์ search | search หาสิ่งที่เพิ่งเข้าไปให้เจอจริง | กัน frontmatter ผิดจนหลุด index เงียบๆ |

ขั้น 1 สำคัญเพราะพอเริ่มแก้ไฟล์ต้นฉบับ จะแยกไม่ออกอีกว่าอะไรคือ
สิ่งที่ tool พูด กับอะไรคือสิ่งที่เราสรุปเอง

ขั้น 2 คือคำสั่งเดียวที่ห้ามข้าม:

```bash
curl -s "https://api.crossref.org/works/10.xxxx/yyyy" \
  | python3 -c "import json,sys; \
d=json.load(sys.stdin)['message']; \
print(d.get('title',[''])[0]); \
print(d.get('container-title',[''])[0])"
```

ผลแบ่งสามกลุ่ม: **confirmed** (Crossref คืน paper เดียวกัน)
**mismatch** (คืนคนละใบ — บันทึกว่าจริงคืออะไร) **not_found**
มีแค่ confirmed เท่านั้นที่ผ่านเข้าการ์ดได้ ขั้น 4 index ขั้น 5
คือขั้นที่มักถูกข้าม

รายงาน AOD ฉบับนี้จบด้วย:

```
confirmed: 8 DOI ยืนยันกับ Crossref
mismatch:  1 (Chen X./10.3390/rs11232771 -> ตัวจริงคือ she2019)
new cards: 6 (nakapan2022 bai2021 choi2019
              meng2015 she2019 chimla2025)
enriched:  2 (jang2025 o2025)
```

ตัวเลขพวกนี้ไม่ใช่ประเด็นหลัก ประเด็นหลักคือ 5 เคสที่เกือบหลุด
รอดต่อไปนี้.

## 14.2 5 เคสที่ AI แต่งข้อมูล — จับได้จากรายงานเดียว

AI แต่งชื่อ paper ได้แบบมีโครงสร้างถูก ไม่ใช่เดามั่ว — ชื่อผู้เขียน
สมจริง ชื่อ paper เข้าหัวข้อ วางเคียง DOI จริงเสียด้วยซ้ำ:

| เคส | สิ่งที่เกิดขึ้น | ถ้าเชื่อจะเสียหายอะไร |
|---|---|---|
| Chen, X. ไม่มีตัวตน | DOI `10.3390/rs11232771` จริงคือ She, Zhang, Wang & Wang (2019) *Remote Sensing* 11(23):2771 — ผิดทั้งชื่อผู้เขียนและ title พร้อมกัน | เขียน citekey `chen2019` ผิด ทั้งที่ paper จริงคือ `she2019` |
| title แต่งคู่ DOI ถูก | DOI ตรง Crossref จริง แต่ title ในการ์ดยังเป็นชื่อที่ Gemini แต่งไว้ ("Validation of GeoNEX...") — title similarity เทียบแล้วได้แค่ 0.33 | เช็คแค่ DOI แล้วปล่อยผ่าน การ์ดผิดอยู่ในคลังได้อีกหลายชั่วโมงโดยไม่มีใครจับ |
| `[Already Catalogued]` ชี้ผิดใบ | Gemini ติดป้าย Bai et al. ว่า catalogued ที่ LGHAP Foundation แล้ว แต่จริงเป็น paper ใบที่ 3 (`bai2021`) ไม่ใช่ `bai2022`/`bai2024` ที่มีอยู่ | เชื่อ marker แล้วเอา DOI ใหม่เขียนทับการ์ดเดิม 2 ใบพังทั้งคู่ พร้อม paper จริงไม่ถูกบันทึกเลย |
| editorial comment แซงอันดับ | ค้นด้วย title Crossref จัดอันดับ editorial comment (`10.5194/amt-2019-46-ec1`) ไว้เหนือ paper จริงที่มันวิจารณ์อยู่ — title คล้ายกันมาก ต่างแค่ท้าย DOI มี `-ec1` | หยิบผลอันดับ 1 มาตรงๆ โดยไม่เช็ค `type` จะได้ comment แทน paper |
| subagent ส่ง paper ผี | subagent ที่ขุด timestamp เพิ่ม กลับมาพร้อม Huang (2020) กับ Prasad & Singh (2007) — ไม่มีทั้งคู่ใน `journal.jsonl` ที่เป็น ground truth ของคลัง | ไม่เช็คกับ journal ground truth จะมีการ์ดของ paper ที่ไม่มีอยู่จริงเข้าคลัง |

บทเรียนตรงไปตรงมา: **DOI ที่ถูก ไม่ได้แปลว่า metadata ที่แนบมาถูก
ด้วย** — title, authors, journal ต้องเทียบกับ Crossref แยกทุก
ฟิลด์ ไม่ใช่เทียบ DOI อย่างเดียว และวินัยนี้ใช้เท่ากันไม่ว่าคำสั่ง
จะมาจาก deep-research tool หรือ subagent ของเราเอง

## 14.3 verify แยกฟิลด์ — คำสั่งจริง

เช็ค `type` field ทุกครั้งที่ verify ด้วย title search — รับแค่
`journal-article` เท่านั้น:

```bash
curl -s "https://api.crossref.org/works?query.bibliographic=TITLE" \
  | python3 -c "import json,sys; \
d=json.load(sys.stdin)['message']['items'][0]; \
print(d.get('type')); \
print(d.get('DOI'))"
# type ต้องเป็น journal-article เท่านั้น
# journal-article-comment / -ec1 -> เลื่อนไปผลถัดไป
```

เช็ค paper ที่ subagent ส่งมากับ ground truth ของ journal ในคลัง
ก่อนเขียนการ์ด:

```bash
# journal.jsonl คือรายชื่อ journal จริงในคลัง — ไม่เจอ = ไม่เขียนการ์ด
rg -i "PROCEEDINGS OF THE NATIONAL ACADEMY" journal.jsonl
# ไม่มีผลลัพธ์ -> Huang (2020) ไม่ถูกเขียนลงการ์ดใดๆ
```

## 14.4 `citation doi --write` — resolve + rekey

```
maw citation doi [--write] [--rekey]
# resolve authors + DOIs against Crossref
# dry run โดย default (ไม่มี --write ไม่เขียนไฟล์)
```

```bash
citation doi                        # dry run: ดูว่าจะเปลี่ยนอะไร
citation doi --all --write --rekey  # เขียนจริง + rename citekey
                                     # placeholder เป็น author-year

# รู้ DOI อยู่แล้ว แต่ title ที่เก็บไว้ผิด (เคสที่ 2 ข้างบน)
citation doi she2019 --doi 10.3390/rs11232771 \
  --trust-doi --write
```

`--trust-doi` คือทางแก้ตรงของเคส "title แต่งคู่ DOI ถูก" — บอก
เครื่องมือว่า DOI นี้เชื่อได้ ให้ดึง title/authors/journal จริงจาก
Crossref มาเขียนทับของเดิมที่แต่งไว้

citekey ต้องตามชื่อผู้เขียนจริงจาก Crossref เสมอ ไม่ใช่ชื่อที่
รายงานอ้างมา — เคส Chen X. ถูกไฟล์เป็น `she2019` ไม่ใช่ `chen2019`

## 14.5 search ไม่เจอ ≠ ไม่มีอยู่

"ค้นครั้งเดียวหาไม่เจอ" เป็นหลักฐานอ่อนมากว่าไม่มีอยู่จริง —
agentic search หนึ่งรอบพลาดได้ง่าย ก่อนเขียนประโยค "ไม่มีงานวิจัย
เรื่องนี้อยู่" ลงวิทยานิพนธ์ ต้องมี search แบบตั้งใจอีกรอบ (เช่น
Scopus/Web of Science) ไม่ใช่เชื่อรอบเดียวจากรายงาน deep-research
