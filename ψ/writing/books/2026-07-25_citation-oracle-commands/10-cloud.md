# บทที่ 10: Index ด้วย Cloud — Cloudflare Workers AI

Index ผ่าน Cloudflare แทนเครื่องตัวเอง ใช้ตอนไม่มี ollama หรือไม่มี GPU (เครื่องยืม, CI) — cloud เป็น**ตัวสำรอง ไม่ใช่ default** `detectBackend()` เช็ค ollama ก่อนเสมอ

**เลขจริงที่วัดมีตัวเดียว**: ollama index 75 รายการ = 8.4 วินาที (บทที่แล้ว) เวลา index ผ่าน worker/cf-rest **ยังไม่ได้วัด** — เครือข่ายคุมไม่ได้เหมือน GPU ในเครื่อง

## 10.1 สามทาง: ollama, worker, cf-rest

สองทาง cloud ยิงไปหา model เดียวกันคือ `@cf/baai/bge-m3` บน Workers AI ต่างกันแค่ auth กับเส้นทาง request:

| ทาง | auth | `CITATION_EMBED` | egress |
|---|---|---|---|
| ollama | ไม่มี | `ollama` | ไม่ออกเน็ต |
| worker `:18787` | wrangler login เดิม | `worker` | ออกเน็ต ผ่าน wrangler dev |
| cf-rest | `CF_ACCOUNT_ID` + `CF_API_TOKEN` | `cf-rest` | ออกเน็ต ตรงไป Cloudflare |

บังคับเลือก backend ด้วย `CITATION_EMBED` (ข้าม auto-detect ของ `detectBackend()`):

```bash
CITATION_EMBED=ollama  ./bin/citation index --vault
CITATION_EMBED=worker  ./bin/citation index --vault
CITATION_EMBED=cf-rest ./bin/citation index --vault
```

**ค่าไม่ถูก validate** — พิมพ์ผิด (เช่น `cloud`) ไม่ error ทันที ไหลไปตกที่ worker แบบเงียบๆ เช็คด้วย `citation status` ทุกครั้งหลังตั้งค่านี้ ดูบรรทัด `✓ embeddings: ...` ว่าตรงกับที่ตั้งใจไหม

worker ใช้ **AI binding** (`[ai]` / `binding = "AI"` ใน `wrangler.toml`) เลยไม่ต้องมี token แยก — wrangler สวมสิทธิ์บัญชีที่ `wrangler login` ไว้ให้ตอน dev server เริ่ม cf-rest ต้องมี token จริง เหมาะกับสคริปต์ headless เช่น CI ที่ไม่มี `wrangler dev` ค้างให้เรียก

## 10.2 เปิด worker

worker บันเดิลอยู่ใน repo แล้วที่ `ψ/lab/citation/worker/` — ไฟล์เดียว (`worker.js` ~80 บรรทัด) ไม่มี `node_modules`:

```bash
cd ψ/lab/citation/worker
wrangler dev --port 18787
```

ครั้งแรกต้อง `wrangler login` ก่อนหนึ่งครั้ง (เปิด browser authorize) จากนั้นรัน `wrangler dev` ซ้ำได้เรื่อยๆ ไม่ต้อง login ใหม่

Contract ของ worker มีสาม endpoint เท่านั้น:

```
POST /embed
  { texts: ["a", "b"] } -> { data: number[][] }
POST /query-embed
  { text: "a query" }   -> { data: number[][] }
GET  /health
  -> { ok: true, model }
```

`/embed` กับ `/query-embed` รับได้ทั้ง `body.texts` และ `body.text` — ยิงผิด field ก็ยังทำงานถูก ปลั๊กอินฝั่ง citation เรียกผ่าน `CF_EMBED_WORKER_URL` (default `http://localhost:18787` อยู่แล้ว ไม่ต้องตั้งอะไรเพิ่ม)

## 10.3 ทดสอบจริง

```bash
curl http://localhost:18787/health
# {"ok": true, "model": "@cf/baai/bge-m3"}

curl -X POST http://localhost:18787/embed \
  -H 'content-type: application/json' \
  -d '{"texts": ["a", "b"]}'
# {"data": [[0.01, -0.02, ...], [0.03, 0.00, ...]]}
```

ส่ง body ว่าง — worker ไม่ crash ไม่โยน stack trace ตอบ HTTP 400 พร้อมข้อความอ่านรู้เรื่อง:

```bash
curl -X POST http://localhost:18787/embed \
  -H 'content-type: application/json' -d '{}'
# {"error": "no non-empty text supplied"}
```

worker ตอบ 500 ถ้า batch ใหญ่เกินไปในคำขอเดียว (56 paper เดี่ยวๆ ผ่าน, paper+vault note รวมกันไม่ผ่าน) โค้ดจึงตัดเป็นก้อนละ 16 เสมอผ่าน `CF_EMBED_BATCH` (ปรับได้ถ้า corpus ใหญ่กว่านี้):

```typescript
const EMBED_BATCH =
  Number(process.env.CF_EMBED_BATCH) || 16;
```

error message บอกดัชนี batch ที่พัง + text ที่ยาวที่สุดในก้อนนั้น ไม่ใช่แค่ "พังที่ไหนสักที่"

## 10.4 account_id หลายบัญชี

`wrangler.toml` **ไม่มี `account_id` โดยเจตนา** — repo เป็น public, account ID ไม่ใช่ secret แต่ก็ไม่มีเหตุผลต้องเผยแพร่ ผลข้างเคียง: ถ้าเครื่อง login มากกว่าหนึ่ง account, wrangler หยุดทำงานทันทีด้วยข้อความนี้:

```
More than one account available but unable to
select one in non-interactive mode.
```

เจอเองจริงตอนทดสอบบนเครื่องที่ login สองบัญชี แก้ด้วยการระบุ account ตรงๆ ผ่าน environment variable ก่อนรัน:

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  wrangler dev --port 18787
```

หา id ได้จาก `wrangler whoami` (list ทุก account ที่ login ไว้พร้อม id)

**ระวังชื่อ env var สองชุด ไม่ใช่ชุดเดียว**: `CLOUDFLARE_ACCOUNT_ID` เป็นของ `wrangler` CLI เอง ใช้ตอนเลือก account ให้ worker ส่วน `CF_ACCOUNT_ID` / `CF_API_TOKEN` (ไม่มี `CLOUDFLARE_` นำหน้า) เป็นของโค้ด `src/index.ts` เองตอนเลือกทาง cf-rest — ตั้งชุดหนึ่งแล้วอีกชุดยังต้องตั้งแยกอยู่ดี

## 10.5 CORS เปิดกว้าง

worker เปิด CORS ให้ทุก origin (`*`) เพราะหน้า `citation serve` (บทที่ 12) ยิง query embedding ตรงจาก browser ไม่ผ่าน proxy ฝั่งเรา — worker เองไม่ถือ secret (ไม่มี token, ไม่มี account credential) ความเสี่ยงจริงคือ "โดนเรียกเกิน free tier" ไม่ใช่ข้อมูลรั่ว

## 10.6 คำเตือน: corpus ที่ยังไม่ตีพิมพ์

**ข้อความที่ส่งไป Cloudflare ไม่ใช่ทั้งไฟล์ แต่คือ `title + summary + thesis_relevance` ต่อ paper — เพียงพอจะเป็นเนื้อความงานวิจัยจริง ไม่ใช่ metadata เฉยๆ**
**worker กับ cf-rest วิ่งผ่านเน็ตจริง ต่างจาก ollama ที่ไม่ออกจากเครื่องเลย — thesis ที่ยังไม่ตีพิมพ์ถ้าหลุดออกไปก่อน เอาคืนไม่ได้**

`index --vault` เสี่ยงกว่า index paper เฉยๆ เพราะดึงโน้ตส่วนตัว (claim, hypothesis) เข้า embed ด้วย ไม่ใช่แค่บทคัดย่อ paper คนอื่นที่ตีพิมพ์แล้ว — ตัดสินใจเองว่าคุ้มไหม ollama ยังเป็น default ที่ถูกเช็คก่อนเสมอในโค้ด

## 10.7 model tag ไม่เดียวกันเสมอ

สลับ backend แล้ว `manifest.json` เปลี่ยน tag: ollama ได้ `ollama:bge-m3`, worker/cf-rest ได้ `cloudflare:@cf/baai/bge-m3` เดียวกันทั้งคู่ (ยิง model เดียวกันบน Cloudflare)

**ยังไม่ได้วัด**ว่า vector จากสอง runtime ตรงกันแค่ไหน — ถือเป็นคนละ index family ห้ามเทียบ cosine ข้ามกัน สลับ backend ต้อง `index --vault` ใหม่ทั้งชุดเสมอ เช็คด้วย `citation status` สองบรรทัด: `embeddings` บอกว่าจะใช้ทางไหนถ้า index ตอนนี้, `store ready` บอกว่าของที่มีอยู่แล้วทำด้วย tag ไหน — สองบรรทัดนี้ไม่ตรงกันแปลว่ายังไม่ได้ index ใหม่หลังสลับ backend

## 10.8 สลับกลับ local + เก็บกวาด

```bash
unset CITATION_EMBED
ollama pull bge-m3            # ถ้ายังไม่เคย pull
./bin/citation status         # เช็คว่าเห็น ollama ไหม
./bin/citation index --vault  # index ใหม่ทั้งชุด
```

`wrangler dev` สร้างโฟลเดอร์ `.wrangler/` ขึ้นมาเอง (cache + account identifier) — **ต้องใส่ `.wrangler/` เข้า `.gitignore` ก่อน commit เสมอ** ไม่มีเหตุผลต้อง commit ของนี้เข้า repo public
