# บทที่ 11: Cafe Mode — เน็ตไม่มี แบตไม่เยอะ ทำงานยังไง

บทนี้บอกว่า verb ไหนใช้ได้ตอนไม่มีเน็ต verb ไหนต้องมี แล้วให้คำสั่ง
เตรียมตัวก่อนออกจากบ้าน ประหยัดแบต และ resolve DOI แบบประหยัด
tethering

## 11.1 ตารางเดียวจบ

| verb | ต้องมีเน็ตไหม | ทำไม |
|---|---|---|
| `status` | ไม่ต้อง | อ่าน sysctl + เช็ค process ในเครื่อง |
| `cards` | ไม่ต้อง | อ่าน/เขียน markdown ใน `ψ/papers/` |
| `index` (รวม `--vault`) | ไม่ต้อง* | embed ผ่าน ollama ที่ localhost |
| `search` | ไม่ต้อง* | embed query ผ่าน ollama local เหมือนกัน |
| `serve` (= `visualize`) | ไม่ต้อง | เสิร์ฟ HTML จาก store ในเครื่อง |
| `graph` | ไม่ต้อง | render จาก store ในเครื่อง → PNG |
| `bib` | ไม่ต้อง | อ่าน card ในเครื่อง → เขียน `.bib` |
| `doi` | **ต้อง** | ยิงตรงไปที่ `api.crossref.org` |

`*` = ต้องเลือก backend เป็น ollama (default) ไม่ใช่ `cf-rest` — สลับ
ไป Cloudflare REST ตามบทที่ 10 แล้ว `index`/`search` จะกลายเป็นต้อง
มีเน็ตทันที เพราะยิงออกไปหา Cloudflare ตรงๆ

## 11.2 บังคับ backend ก่อนออกจากบ้าน

`index`/`search` เลือก backend เอง 3 ชั้น: ollama local ก่อน → ถ้า
ไม่เจอ ลอง Cloudflare worker `:18787` (ต้องมี `wrangler dev` รันอยู่
ในเครื่อง) → สุดท้ายไปที่ Cloudflare REST (ต้องมี `CF_ACCOUNT_ID` +
`CF_API_TOKEN` และเน็ตจริง) ลืม `ollama pull` มา แล้วก็ไม่ได้เปิด
`wrangler dev` ไว้ — มันไหลไปจบที่ REST ซึ่งพังทันทีถ้าไม่มีเน็ต
(หรือแย่กว่านั้นคือมี tethering นิดหน่อยแล้วมันใช้ไปจริงโดยไม่รู้ตัว)
บังคับ backend กันหลุดไปทางอื่น:

```bash
export CITATION_EMBED=ollama
```

ตั้งไว้ครั้งเดียวใน shell profile — ถ้า ollama ไม่พร้อม มัน error
ตรงๆ ทันที ดีกว่าเงียบๆ แล้วไปโดนบิล tethering ทีหลัง

## 11.3 เตรียมตัวก่อนออกจากบ้าน

Store เป็นไฟล์ธรรมดา 3 ไฟล์ ไม่มี database: `vectors.f32`
(N × 1024 Float32), `meta.jsonl`, `manifest.json` รวม **452 KB**
(75 รายการ: 62 paper + 13 vault note) — `vectors.f32` เอง
**300 KB** เล็กพอ zip ใส่ USB ได้ ลบทิ้งแล้ว index ใหม่ได้เสมอ
เพราะเป็น derived data ไม่ใช่ source of truth

```bash
# ครั้งแรกดาวน์โหลด model ~1.2 GB — pull ครั้งเดียวพอ
ollama pull bge-m3

# index ทั้ง paper และ vault note — 75 รายการ วัดจริง
# (model warm บน GPU แล้ว): 8.4 วินาที
maw citation index --vault
```

Embed เฉพาะ `title + summary + thesis_relevance` ต่อกัน ไม่ใช่
`doi`/`volume`/`pages` — เติม DOI เข้า card ทีหลัง**ไม่ต้อง index
ใหม่** เติมได้แม้ตอนไม่มีเน็ต

เช็คก่อนปิดเครื่องด้วย `maw citation status`:

```
── citation status ──
  ✓ store ready — 62 paper(s) + 13 vault note(s) · 1024-dim
      · 300 KB · model bge-m3
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB unified
      memory — Metal GPU available to ollama
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434 — local,
      no token, no egress — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU
        (fully resident — no CPU fallback) · 8192 ctx
```

`100% GPU` = model โหลดเต็มก้อนบน GPU ไม่มีตกไป CPU checklist
สุดท้ายก่อนออกจากบ้าน:

```
[ ] ollama pull bge-m3 เสร็จแล้ว — เช็คด้วย `ollama list`
[ ] maw citation index --vault รันผ่าน ไม่มี error
[ ] maw citation status เห็น backend: ollama (ไม่ใช่ cf-rest)
[ ] card ที่ยังไม่มี DOI — resolve ให้ครบตอนนี้
    (doi ต้องมีเน็ตเท่านั้นที่ทำได้จริง)
```

ลืมข้อแรก แล้วถึงร้านค่อยนึกได้ — `index`/`search` จะ error ทันที
เพราะ ollama หา model ไม่เจอในเครื่อง และไม่มีเน็ต pull ให้ก็ไม่ได้
ทางตันทั้งสองทาง เตรียมที่บ้านเท่านั้น ร้านกาแฟไม่มีเน็ตพอให้ pull
1.2 GB แบบสบายใจ

## 11.4 ประหยัดแบต — ปิด serve เอง ollama ปิดตัวเอง

`serve` เปิด `Bun.serve()` ค้าง event loop ไว้ตลอด — ไม่จบเองแม้ปิด
แท็บเบราว์เซอร์ที่เข้าไปดูแล้ว ปิดด้วย Ctrl+C ตอนดูจบ ไม่มีเหตุผล
ต้องเปิดค้างไว้ทั้งวันถ้าไม่ได้ดูซ้ำ

ollama unload model เองหลังไม่มีการเรียกใช้ประมาณ **5 นาที** —
ค่า default ของ ollama เอง ไม่ใช่โค้ดของเรา ปล่อยให้ unload เอง
ดีกว่ายิง request ปลอมๆ กันไม่ให้ idle:

```bash
# ดูว่า model กำลังโหลดอยู่หรือ unload ไปแล้ว — เช็คฟิลด์ expires_at
curl -s http://localhost:11434/api/ps | jq
```

วัดจริงบน m5: bge-m3 กิน **634 MB** VRAM ที่ context 8192 resident
แบบ **100% GPU** (ยืนยันด้วย `size_vram == size` — เท่ากันแปลว่าอยู่
บน GPU ทั้งก้อน ไม่มีตกไป CPU)

## 11.5 tethering น้อยๆ — `doi` ทีละใบ ไม่ใช่ `--all`

รูปแบบเต็ม: `maw citation doi [--write] [--rekey] [--all]
[citekey…]` — ไม่ระบุ citekey และไม่ใส่ `--all` มันจะเดาเอง เลือก
ทุก card ที่ยังไม่มี DOI หรือ author อัตโนมัติ คุมจำนวน request
ไม่ได้ — บน tethering เลี่ยงไว้ ระบุ citekey ให้แคบแทน:

```bash
# dry run — ดูผลก่อน ยังไม่บันทึก
maw citation doi mahajan2025

# พอใจแล้วค่อยเขียนทับ card จริง
maw citation doi mahajan2025 --write
```

dry run กับ `--write` ยิง request ไป Crossref เท่ากัน ต่างกันแค่
ตอนท้ายว่าจะเขียนทับ card หรือไม่ — รู้อยู่แล้วว่าจะบันทึกแน่ ใส่
`--write` ตั้งแต่รอบแรกประหยัดกว่า ไม่ต้องยิงซ้ำสองรอบ

ไม่มีเน็ตตอนลอง `doi` — ไม่ crash เงียบๆ request ไป
`api.crossref.org` จะ timeout แล้ว report error ตรงๆ ว่า resolve
ไม่ได้

`serve` ผูก port default **5556** เปลี่ยนได้ด้วย `--port` หรือ env
`CITATION_VISUALIZE_PORT` — ลืมปิดรอบก่อนไว้ (Ctrl+C ไม่ทัน) พอเปิด
รอบใหม่มันเจอ port ไม่ว่าง แล้วขยับไปหา port ถัดไปเองอัตโนมัติ:

```
⚠ port 5556 busy (an earlier serve is still running) — using 5557
✦ citation constellation (2D) — http://localhost:5557
```

## 11.6 กลับบ้านแล้วไม่ต้อง sync

ใช้ backend ollama ตลอดวัน ไม่มีอะไรถูกส่งขึ้น cloud เลยสักบรรทัด —
card ที่แก้เขียนลงดิสก์ทันทีตอนแก้ store update ทันทีตอน `index`
รันเสร็จ ไม่มี state ไหนแขวนคอยรอ sync ทีหลัง

ข้อยกเว้นเดียว: สลับไป Cloudflare REST ระหว่างวันตามบทที่ 10 (ต้องมี
`CF_ACCOUNT_ID` + `CF_API_TOKEN` จริง) — กรณีนั้นข้อมูลออกนอกเครื่อง
จริง ต้องดูข้อควรระวังเรื่อง corpus ที่ยังไม่ตีพิมพ์ตามบทนั้น สำหรับ
cafe mode ทางเลือกที่ดีที่สุดคือปล่อยให้ ollama เป็น backend ตลอด
ไม่ต้องตัดสินใจอะไรเพิ่ม
