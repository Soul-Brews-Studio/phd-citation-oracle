---
title: "คู่มือ Citation Oracle ฉบับสมบูรณ์"
subtitle: "จาก paper 62 ใบ ไปเป็น .bib ที่ส่งวิทยานิพนธ์ได้ — ทุกเครื่อง ทุกที่ ทุกงบ"
author: Citation Oracle
human: Nat Weerawan (ณัฐ วีระวรรณ์)
date: 2026-07-25
language: Thai (kien-thai 7 frames)
register: คู่มือช่างที่นั่งข้างๆ — ตรงไปตรงมา ไม่ขายของ ยอมรับตอนพัง
target_chapters: 15
target_words_per_chapter: 3000-3500
parts: 3
repo: https://github.com/Soul-Brews-Studio/phd-citation-oracle
---

# Outline — คู่มือ Citation Oracle ฉบับสมบูรณ์

โครงจากที่ Nat สั่งไว้ตรงๆ: เตรียมตัว → เตรียมของ → ลงอุปกรณ์ → โครงสร้าง → วิธีใช้
แล้วต่อด้วยเรื่อง Index (cloud / local / CPU / M5 / cafe) และวงจร research
(ทำ research → ส่งให้ GPT → เอากลับมา)

**กฎของเล่มนี้: ทุกคำสั่งต้องรันจริงแล้ว** เลขทุกตัวมาจาก output จริงบนเครื่อง m5
(Apple M5 Max, arm64, 18 cores, 128 GB unified memory) — ไม่มีตัวเลขไหนเดาเอา

---

## ภาค 1 — เตรียมตัว (บทที่ 1–5)

### บทที่ 1: บทเตรียมตัว — เล่มนี้ทำให้ได้อะไร ใครควรอ่าน

target_words: 3000
dna: **The Honest Start** — บอกก่อนว่าเครื่องมือนี้ไม่ทำอะไร
soul_thread: "ทุกข้อกล่าวอ้างต้องมีดาวดวงอื่นค้ำไว้"
subtopics:
  - 1.1 ปัญหาจริง: corpus 62 ใบ ที่ไม่มี `.bib` ไม่มี DOI ยืนยัน
  - 1.2 สิ่งที่เครื่องมือนี้ทำ / ไม่ทำ (ไม่ได้เขียน related work ให้)
  - 1.3 ใครควรอ่าน — คนทำ thesis, คนดูแล corpus, คนอยาก reuse pattern
  - 1.4 ผลลัพธ์จริง: DOI 8/62 → 61/62 · เจอ error 18 จุด ใน 14 card
  - 1.5 กฎ 6: oracle ไม่แกล้งเป็นคน — ใครเขียนเล่มนี้
proof:
  - artifacts/citation-audit.md
  - commit c01b2f5, e3c7f74
checklist:
  - [ ] บอกข้อจำกัดก่อนบอกความสามารถ
  - [ ] ไม่สัญญาว่าจะเขียนวิทยานิพนธ์ให้

### บทที่ 2: เตรียมของ — ต้องมีอะไรบ้าง (จริงๆ แค่ 2 อย่าง)

target_words: 3000
dna: **Two Things Only** — bun กับ ollama จบ
soul_thread: "ของที่ไม่ต้องลง คือของที่ไม่พัง"
subtopics:
  - 2.1 ของที่ **ต้องมี**: bun (runtime) — แค่นั้น
  - 2.2 ของที่ **ควรมี**: ollama + bge-m3 (สำหรับ search)
  - 2.3 ของที่ **ไม่ต้องมี**: node_modules, database, API key, Docker
  - 2.4 ทำไม 487 MB → 140 KB (ตัด LanceDB + sharp ออก)
  - 2.5 เช็คว่าพร้อมไหมด้วยคำสั่งเดียว: `./bin/citation status`
proof:
  - ψ/lab/citation/package.json (dependencies ว่าง)
  - commit 5475615
checklist:
  - [ ] แยก ต้องมี / ควรมี / ไม่ต้องมี ให้ชัด
  - [ ] มี output จริงของ status

### บทที่ 3: เตรียมลงอุปกรณ์เพิ่มเติม — ของเสริมที่ลงเมื่อจำเป็น

target_words: 3000
dna: **Optional Means Optional** — ของเสริมที่ขาดได้ต้องขาดได้จริง
soul_thread: "ถ้าไม่มีก็ต้องยังทำงานได้"
subtopics:
  - 3.1 `sharp` — เอาไว้ออก PNG (ไม่มีก็ได้ SVG ซึ่งคมกว่าอยู่แล้ว)
  - 3.2 `maw` — federation engine ของ oracle family (ไม่มีก็ใช้ `./bin/citation`)
  - 3.3 `wrangler` — สำหรับ cloud embedder (ไม่มีก็ใช้ ollama)
  - 3.4 TeX (`bibtex`) — เอาไว้ *ตรวจ* ว่า .bib ใช้ได้จริง
  - 3.5 บทเรียน: dynamic import กับ try/catch คือวิธีทำ optional ให้จริง
proof:
  - ψ/lab/citation/src/index.ts:1551 (await import("sharp") ใน try/catch)
  - commit 4204da2 (NUL byte ทำให้ rg มองไม่เห็น import นี้)
checklist:
  - [ ] ทุกตัวบอกว่า "ถ้าไม่มีจะเป็นยังไง"
  - [ ] เล่าเคส NUL byte ตรงๆ

### บทที่ 4: โครงสร้าง — ของอยู่ไหน อะไรคือของจริง

target_words: 3500
dna: **Cards Are The Truth** — markdown คือ source of truth ไม่ใช่ database
soul_thread: "การ์ดคือความจริง JSONL เป็นแค่ทางเข้า"
subtopics:
  - 4.1 แผนที่ทั้ง repo: `ψ/` `artifacts/` `bin/` `.claude/skills/`
  - 4.2 `ψ/papers/` — 1 การ์ด = 1 paper · ชื่อไฟล์ = citekey = คีย์ใน `\cite{}`
  - 4.3 frontmatter 20 field ทีละตัว — ตัวไหนบังคับ ตัวไหน optional
  - 4.4 `## Notes` กับกฎ "regenerate แล้วไม่หาย" (พร้อมสิ่งที่รอดเพิ่มเติม)
  - 4.5 store 3 ไฟล์: `vectors.f32` / `meta.jsonl` / `manifest.json`
  - 4.6 `aka:` กับ `authors_upstream:` — ทำไมไม่มีอะไรถูกลบ
proof:
  - ψ/papers/mahajan2025.md
  - .citation/store/manifest.json
checklist:
  - [ ] อธิบาย field ทุกตัว ไม่ข้าม
  - [ ] บอกว่า field ไหนถูก embed field ไหนไม่

### บทที่ 5: วิธีการใช้งาน — 8 คำสั่ง เรียงตามลำดับที่ใช้จริง

target_words: 3500
dna: **The Verb Order** — คำสั่งเรียงตามงาน ไม่ใช่ตามตัวอักษร
soul_thread: "status ก่อนเสมอ — มันบอกความจริงของเครื่องเรา"
subtopics:
  - 5.1 `status` — คำสั่งที่อธิบายตัวเอง (root มาจากกฎไหน)
  - 5.2 `cards` — JSONL → การ์ด (idempotent)
  - 5.3 `doi` — ถาม Crossref (dry run เป็น default)
  - 5.4 `bib` → `artifacts/citation.bib`
  - 5.5 `index` / `search` — และ `--vault` ที่รวม paper กับ note เข้าด้วยกัน
  - 5.6 `serve` / `graph` — ดูกลุ่มดาว
  - 5.7 ลำดับที่ใช้จริงตอนเริ่มจากศูนย์
proof:
  - output จริงของทุกคำสั่ง
checklist:
  - [ ] ทุกคำสั่งมี output จริงประกอบ
  - [ ] บอก flag ที่ใช้บ่อยเท่านั้น ไม่ยัดทั้งหมด

---

## ภาค 2 — Index ทุกแบบ (บทที่ 6–11)

### บทที่ 6: Index คืออะไร ทำไมต้องทำ

target_words: 3000
dna: **Embedding Is Not Search** — vector ไม่ใช่ keyword
soul_thread: "มันไม่ได้จำคำ มันจำความหมาย"
subtopics:
  - 6.1 embed คืออะไร — ข้อความ → ตัวเลข 1024 ตัว
  - 6.2 **อะไรถูก embed**: `title + summary + thesis_relevance` (ไม่ใช่ทั้งไฟล์)
  - 6.3 cosine similarity อธิบายแบบไม่ใช้สมการ
  - 6.4 brute force ทำไมพอ — 75 แถว ~0.2 วินาที ไม่ต้องมี ANN
  - 6.5 `manifest.json` จำชื่อ model — สลับ model ต้อง index ใหม่ทั้งชุด
  - 6.6 ตอนไหนต้อง index ใหม่ ตอนไหนไม่ต้อง (ตาราง)
proof:
  - ψ/lab/citation/src/index.ts (paperText, storeSearch)
checklist:
  - [ ] ไม่ใช้สมการ แต่ต้องถูก
  - [ ] บอกตรงๆ ว่า bge-m3 ไม่บอก keyword ให้เราได้

### บทที่ 7: Index แบบ Local — ollama บนเครื่องเรา

target_words: 3000
dna: **Nothing Leaves The Machine** — ไม่มี token ไม่ออกเน็ต
soul_thread: "งานวิจัยที่ยังไม่ตีพิมพ์ ไม่ควรออกจากเครื่อง"
subtopics:
  - 7.1 ทำไม local เป็น default (ความเป็นส่วนตัวของ corpus ที่ยังไม่ตีพิมพ์)
  - 7.2 `ollama pull bge-m3` — 1.2 GB ครั้งเดียว
  - 7.3 รันจริง: 74 รายการ ใช้เวลาเท่าไหร่
  - 7.4 batch 16 — และทำไมยิงทีเดียวหมดแล้ว 500
  - 7.5 debug: `no embedding backend reachable` แก้ยังไง
proof:
  - output จริงของ index --vault
checklist:
  - [ ] มีเวลาจริง ไม่ใช่ "เร็ว"

### บทที่ 8: Index ด้วย CPU — เครื่องไม่มี GPU ทำยังไง

target_words: 3000
dna: **Slow Is Still Fine** — ช้าแต่จบงานได้
soul_thread: "เครื่องเล็กไม่ใช่ข้ออ้าง"
subtopics:
  - 8.1 ollama บน CPU: ได้ แต่ช้ากว่า — ช้าแค่ไหน
  - 8.2 อ่าน `size_vram` เทียบ `size` เพื่อรู้ว่าตกไป CPU หรือยัง
  - 8.3 ทางเลือกเมื่อ RAM น้อย: batch เล็กลง (`CF_EMBED_BATCH=8`)
  - 8.4 corpus แค่นี้ CPU ก็พอ — 62 ใบไม่ใช่ 62,000 ใบ
  - 8.5 ตอนไหนควรยอมใช้ cloud แทน
proof:
  - /api/ps size_vram vs size
checklist:
  - [ ] ไม่ดูถูกเครื่องเล็ก
  - [ ] บอกวิธีวัดว่าตก CPU จริงไหม

### บทที่ 9: Index บน M5 Apple Silicon — Metal กับ unified memory

target_words: 3000
dna: **Unified Memory Changes The Math** — ไม่ต้องคัดลอกข้าม VRAM
soul_thread: "ของแรงที่มีอยู่แล้ว ใช้ให้คุ้ม"
subtopics:
  - 9.1 unified memory คืออะไร ต่างจาก discrete GPU ยังไง
  - 9.2 ยืนยันว่าใช้ GPU จริง: `100% GPU (fully resident — no CPU fallback)`
  - 9.3 `status` บอก hardware ให้ — ทำไมเราเพิ่มบรรทัดนี้เข้าไป
  - 9.4 เลขจริงบน M5 Max: 634 MB · 8192 ctx · 18 cores · 128 GB
  - 9.5 บทเรียน: คำโฆษณาที่ไม่มีใครวัด จะกลายเป็นคำโฆษณาที่ไม่จริง
proof:
  - hardwareLine() + ollamaResidency() ใน index.ts
  - output จริงของ status
checklist:
  - [ ] เลขทุกตัวจากเครื่องจริง
  - [ ] อธิบายว่าทำไม "GPU-backed" ในเอกสารเฉยๆ ไม่พอ

### บทที่ 10: Index ด้วย Cloud — Cloudflare Workers AI

target_words: 3000
dna: **Cloud As Fallback, Not Default** — เมฆเป็นตัวสำรอง
soul_thread: "เลือกได้ ไม่ใช่ถูกบังคับ"
subtopics:
  - 10.1 สองทาง: worker (`:18787`) กับ REST (`CF_ACCOUNT_ID` + `CF_API_TOKEN`)
  - 10.2 worker ใช้ wrangler login เดิม — ไม่ต้องมี token ใหม่
  - 10.3 `CITATION_EMBED` บังคับเลือก backend
  - 10.4 ข้อควรระวัง: corpus ที่ยังไม่ตีพิมพ์ ออกเน็ตแล้วเอาคืนไม่ได้
  - 10.5 model เดียวกัน (bge-m3) แต่ vector เทียบกันได้ไหม — ต้องระวังอะไร
proof:
  - detectBackend() ใน index.ts
checklist:
  - [ ] เตือนเรื่องข้อมูลออกเน็ตแบบไม่ตื่นตูม
  - [ ] บอกวิธีสลับกลับ

### บทที่ 11: Cafe Mode — เน็ตไม่มี แบตไม่เยอะ ทำงานยังไง

target_words: 3000
dna: **Offline By Design** — ออฟไลน์ได้ตั้งแต่ออกแบบ
soul_thread: "งานที่ต้องต่อเน็ต คืองานที่ทำไม่ได้บนรถไฟ"
subtopics:
  - 11.1 อะไรทำได้แบบไม่มีเน็ต: `search` `serve` `graph` `bib` (store อยู่ในเครื่อง)
  - 11.2 อะไร**ต้อง**มีเน็ต: `doi` (Crossref) เท่านั้น
  - 11.3 เตรียมตัวก่อนออกจากบ้าน: `index --vault` ให้เสร็จ + `ollama pull` ไว้แล้ว
  - 11.4 ประหยัดแบต: ปิด `serve` ตอนไม่ใช้ · ollama unload เองหลัง 5 นาที
  - 11.5 tethering น้อยๆ: `doi` ใบเดียวด้วย `citation doi <citekey>`
  - 11.6 กลับบ้านแล้วค่อย sync — ไม่มีอะไรค้างในเมฆ
proof:
  - store เป็นไฟล์ธรรมดา 300 KB
  - รายการ verb ที่ไม่แตะเน็ต
checklist:
  - [ ] แยกให้ชัดว่าอะไรออฟไลน์ได้จริง (ทดสอบ)

---

## ภาค 3 — วงจร Research (บทที่ 12–15)

### บทที่ 12: วิธีการทำ Research — จากคำถามไปเป็น brief

target_words: 3000
dna: **The Brief Is The Steering Wheel** — พวงมาลัยมีอันเดียว
soul_thread: "เครื่องมือ research วิ่งผิดทางได้ 20 นาที ถ้า brief ไม่ดี"
subtopics:
  - 12.1 ทำไม brief สำคัญกว่าคำถาม — tool ขยาย prompt เป็น plan
  - 12.2 5 อย่างที่ brief ต้องมี (objective ผูกกับการตัดสินใจ, out-of-scope, source bar, output sections, สิ่งที่เรารู้แล้ว)
  - 12.3 out-of-scope คือ lever ที่แรงที่สุด
  - 12.4 skill `/gemini-deep-research` ทำอะไรให้
  - 12.5 อ่าน plan ก่อนกด approve ทุกครั้ง
proof:
  - .claude/skills/gemini-deep-research/
  - ψ/writing/prompts/
checklist:
  - [ ] ยกตัวอย่าง brief จริงที่เคยใช้

### บทที่ 13: เอาไปให้ GPT / Gemini อ่าน — ส่งออกยังไง

target_words: 3000
dna: **Hand Off What It Can Read** — อย่าขออะไรที่มันทำไม่ได้
soul_thread: "paywall, ไฟล์ในเครื่อง, การรัน code — สามอย่างที่มันทำไม่ได้"
subtopics:
  - 13.1 ข้อจำกัดจริงของ deep-research tool (อ่าน paywall ไม่ได้)
  - 13.2 เอา context จาก vault ไปด้วยยังไง (`search --json`)
  - 13.3 บอกให้มัน flag สิ่งที่ยืนยันไม่ได้ แทนที่จะเกลี่ยให้เรียบ
  - 13.4 บังคับให้ใส่ DOI/URL ทุกอ้างอิง และห้ามแต่ง
  - 13.5 เก็บ brief ไว้ใน repo — reusable กับหัวข้ออื่น
proof:
  - ψ/writing/prompts/
checklist:
  - [ ] บอกสิ่งที่ tool ทำไม่ได้ก่อนสิ่งที่ทำได้

### บทที่ 14: เอากลับมาทำยังไง — ingest แล้ว *ต้อง* verify

target_words: 3500
dna: **Trust Nothing, Check Everything** — ของที่ได้มาต้องผ่าน Crossref ก่อน
soul_thread: "AI แต่งชื่อ paper ได้ และมันดูน่าเชื่อมาก"
subtopics:
  - 14.1 ขั้นตอน: เก็บไฟล์ดิบไว้ก่อน (provenance) → verify → ทำการ์ด → index
  - 14.2 **เคสจริง**: รายงานแต่งชื่อผู้เขียนเป็น "Chen, X. et al." ทั้งที่เป็น She et al.
  - 14.3 **เคสจริง 2**: title ที่แต่งขึ้น อยู่กับ DOI ที่ถูก — ไม่มีใครเทียบสองอย่างนี้
  - 14.4 `[Already Catalogued]` ที่ชี้ผิดใบ — ถ้าเชื่อ จะเขียน DOI ผิดทับการ์ดเดิม
  - 14.5 skill `/research-ingest` กับ `/research-harvest` ต่างกันยังไง
  - 14.6 harvest = เปลี่ยนรายงานเป็น "การตัดสินใจ + คิวตรวจ + ช่องว่าง"
proof:
  - ψ/writing/research/2026-07-25_se-asia-satellite-aod-validation.md (## Review)
  - ψ/writing/research/2026-07-25_aod-harvest-comparator-decision.md
checklist:
  - [ ] เล่าเคสแต่ง citation ให้ละเอียด ไม่กลบ
  - [ ] บอกว่า absence ที่ search ไม่เจอ ≠ absence จริง

### บทที่ 15: .bib กับบทเรียน 18 ข้อ — ปิดเล่ม

target_words: 3500
dna: **A Citation That Looks Right Isn't One** — ดูถูกไม่ได้แปลว่าถูก
soul_thread: "ทั้ง 18 จุดมองไม่เห็น จนกระทั่งไปถามคนนอก"
subtopics:
  - 15.1 `bib` ทำงานยังไง — และทำไม `et al.` ไม่ใช่ชื่อคน (`and others`)
  - 15.2 การ์ดที่ไม่ครบ = comment ไว้ ไม่ลบ
  - 15.3 ยืนยันด้วย `bibtex` จริง: 62 entry · 62 `\bibitem` · 0 warning
  - 15.4 error 18 จุด แยกประเภท (ผู้เขียนผิด 7 · title แต่ง 1 · หน้าผี 7 · journal 1 · volume 2)
  - 15.5 เลขหน้าที่มาจากเลขท้าย DOI — บั๊กที่เงียบที่สุด
  - 15.6 ที่ oracle ผิดเอง: นับ error ตัวเองผิด · บอกว่า "แก้แล้ว" โดยเทสผ่าน pipe ไม่ใช่ TTY
  - 15.7 ต่อจากนี้: citation edges, `jarernwong2021` ที่ยังไม่มี DOI
proof:
  - artifacts/citation.bib
  - artifacts/citation-audit.md
  - commit e3c7f74 (แก้เลขที่นับผิด)
checklist:
  - [ ] ยอมรับความผิดของตัวเองแบบมีรายละเอียด
  - [ ] ปิดแบบมองไปข้างหน้า ไม่สรุปซ้ำ
