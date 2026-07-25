# บทที่ 10: Index ด้วย Cloud — Cloudflare Workers AI

บทที่แล้วเราวัดเลขจริงบน M5 Max — index ทั้ง 75 รายการ (62 paper
+ 13 note) ใช้เวลา 8.4 วินาที model วิ่งอยู่บน GPU เต็ม 100%
เลขนี้สวยเพราะมี unified memory 128 GB รออยู่หลังบ้าน
แต่ไม่ใช่ทุกเครื่องจะมีของแบบนี้ เครื่องที่ยืมมาใช้ชั่วคราว
เครื่องที่ยังไม่เคย `ollama pull` อะไรเลย หรือ CI ที่ไม่มี GPU
ให้เลือก — ทางนี้แหละที่บทนี้พูดถึง: ยิง embed ออกไปที่ Cloudflare
แทนที่จะให้เครื่องเราคำนวณเอง

ขอบอกจุดยืนก่อนเข้าเนื้อหา: cloud เป็น**ตัวสำรอง ไม่ใช่ default**
`detectBackend()` ในโค้ดเช็ค ollama ก่อนเสมอ พอเจอว่า ollama ไม่รัน
หรือยังไม่มี model ถึงจะไล่ไปทาง Cloudflare — บทนี้ไม่ได้ชวนให้ย้ายมาใช้
cloud เป็นหลัก เขียนไว้เผื่อวันที่ทางเลือกอื่นหมดจริงๆ

เลขที่วัดจริงบน m5 ในบทนี้มีแค่ตัวเดียวคือ 8.4 วินาทีของ ollama
ที่ยกมาเทียบให้เห็นภาพ — เวลา index ผ่าน worker หรือ cf-rest
**เรายังไม่ได้วัด** เครือข่ายเป็นตัวแปรที่ควบคุมไม่ได้เหมือน GPU
ในเครื่องตัวเอง จะช้ากว่าหรือเร็วกว่า 8.4 วินาทีก็ได้ทั้งนั้น
ถ้าใครลองแล้วอยากรู้ตัวเลขจริง จับเวลา `index --vault`
เทียบกับ local ได้เลย วิธีเดียวกับที่บทที่ 8 สอนไว้สำหรับ CPU

ก่อนเข้าเนื้อหา มีเรื่องหนึ่งต้องแก้ให้ตรงก่อน — ตอนบทนี้
เขียนครั้งแรก worker ตัวที่ทางคลาวด์ใช้อยู่ที่
`~/.maw/plugins/cf-embed/worker` ซึ่งอยู่**นอก repo นี้เลย**
พอมีคนอื่น clone repo ไปใช้ ก็จะพบว่าคำสั่งในบทนี้ชี้ไปยัง
โฟลเดอร์ที่เครื่องเขาไม่มี — ทางเลือก cloud ที่เขียนไว้ในเอกสาร
เลยใช้ไม่ได้จริง สิ่งที่บันทึกไว้เป็นแค่ "มีทาง" แต่ไม่ใช่
"มีของ" ปัญหานี้ถูกแก้แล้วในคอมมิต `a2b33fc` — worker ถูกย้าย
เข้ามา bundle อยู่ใน repo ที่ `ψ/lab/citation/worker/` ตั้งแต่นั้น
ทุกคำสั่งในบทนี้จากนี้ไปจะใช้ path ใหม่นี้เสมอ

พูดตามหลักที่เรายึดอยู่แล้ว — เอกสารที่บอกว่า "มีทาง cloud"
แต่ path จริงใช้ไม่ได้ ก็คือเอกสารที่โกหกโดยไม่ตั้งใจ สิ่งที่
**เขียนไว้** (intention) กับสิ่งที่ **ใช้งานได้จริง** (pattern)
ต้องตรงกัน — บทนี้เคยพลาดข้อนี้เอง ก่อนจะแก้ในคอมมิต `a2b33fc`
เป็นตัวอย่างที่จับต้องได้ของหลักการที่เราถืออยู่

## 10.1 สามทาง: ollama, worker, cf-rest — ต่างกันตรงไหน

Cloudflare ฝั่งเรามีสองประตูให้เดินเข้า ไม่ใช่ประตูเดียว — รวมกับ
ollama ที่เป็นค่า default อยู่แล้ว เท่ากับมีสามทางทั้งหมด
ทั้งคู่ที่เป็นฝั่ง cloud ยิงไปหา model เดียวกันคือ
`@cf/baai/bge-m3` บน Workers AI ต่างกันแค่ **วิธียืนยันตัวตน**
กับ **เส้นทางที่ request วิ่งผ่าน**

ทางแรกคือ **worker ที่ `:18787`** — เซิร์ฟเวอร์ dev ตัวเล็กที่รันอยู่
บนเครื่องเรา (`wrangler dev`) แล้วมันรับ text จาก citation ส่งต่อไป
Cloudflare Workers AI ให้อีกที ใช้ session ที่ `wrangler login` ไว้แล้ว
ไม่ต้องสร้าง API token ใหม่เลย

เหตุผลที่ไม่ต้องมี token ต่างหากคือกลไกที่เรียกว่า **AI binding**
— ใน `wrangler.toml` มีบรรทัด `[ai]` กับ `binding = "AI"` ผูกไว้
พอ worker รันอยู่ภายใต้ `wrangler dev` แล้ว โค้ดข้างในเรียก
`env.AI.run(...)` ได้ตรงๆ โดยไม่ต้องแนบ credential ไปกับ
request เลยสักตัว — wrangler เป็นคนสวมสิทธิ์บัญชีที่ login ไว้
ให้ตอน dev server เริ่มทำงาน สิทธิ์นั้นอยู่แค่ในกระบวนการนั้น
ไม่มีการเขียน token ลงไฟล์ไหนในโฟลเดอร์ worker เลย

ทางที่สองคือ **REST ตรง** — ยิงไปที่
`api.cloudflare.com/client/v4/accounts/.../ai/run/...` โดยตรง
ทางนี้ต้องมี `CF_ACCOUNT_ID` กับ `CF_API_TOKEN` เป็น token จริง
ไม่พึ่ง session ของ wrangler เลย เหมาะกับเครื่องที่ไม่เคย login
wrangler มาก่อน หรือสคริปต์ที่รันแบบ headless เช่นใน CI

โค้ดในไฟล์ `src/index.ts` เขียนคอมเมนต์ไว้ตรงๆ ว่าสามทางนี้
เรียงลำดับยังไง (ยกมาแบบตัดบรรทัดให้อ่านง่ายในหน้ากระดาษ):

```typescript
// ── embedding backends ──
// Three, tried in this order unless
// CITATION_EMBED is set:
//   ollama  — fully local, GPU (Metal on
//             Apple silicon). No account,
//             no token, no network. Default
//             when it is running.
//   worker  — the shared wrangler-dev
//             Cloudflare worker on :18787.
//   cf-rest — Cloudflare REST with
//             CF_ACCOUNT_ID + CF_API_TOKEN.
```

สังเกตคำว่า "no network" ผูกอยู่กับ ollama บรรทัดเดียว
worker กับ cf-rest ไม่มีคำนี้ต่อท้าย — นั่นคือความต่างที่สำคัญที่สุด
ในบทนี้ พูดละเอียดในหัวข้อ 10.7

สรุปเป็นตารางเทียบให้เห็นชัดๆ:

| ทาง | auth | ต้องสร้าง token ใหม่ไหม | egress |
|---|---|---|---|
| ollama | ไม่มี | ไม่ต้อง | ไม่ออกเน็ต |
| worker `:18787` | wrangler login เดิม | ไม่ต้อง | ออกเน็ต ผ่าน wrangler dev |
| cf-rest | `CF_API_TOKEN` | ต้อง | ออกเน็ต ตรงไป Cloudflare |

จะเลือกทางไหนก็ขึ้นกับว่ากำลังนั่งอยู่ตรงไหน — ถ้ากำลังนั่งพิมพ์
เองอยู่หน้าเครื่อง มี terminal เปิดค้างไว้ได้ worker สะดวกกว่า
เพราะไม่ต้องไปหา token มาใส่ ถ้าเป็นสคริปต์ที่รันแบบไม่มีคนเฝ้า
เช่น cron หรือ CI ที่ไม่มี `wrangler dev` ค้างให้เรียก cf-rest
คือทางเดียวที่ทำได้จริง เพราะ REST ไม่ต้องพึ่ง process อื่นเลย

## 10.2 เปิด worker — ไฟล์เดียว ไม่มี dependency

worker ที่ bundle มาใน repo ตอนนี้ไม่ใช่ของใหญ่โตอะไรเลย
เป็นไฟล์ JavaScript เดียว (`worker.js`) ยาวประมาณ 80 บรรทัด
ไม่มี `node_modules` ไม่มี dependency ให้ต้อง `npm install`
ก่อนรัน — โครงสร้างทั้งโฟลเดอร์มีแค่สามไฟล์ที่ commit ไว้จริง
(ไม่นับ `.wrangler/` ที่เป็น state ชั่วคราวซึ่งพูดถึงในหัวข้อ 10.9):

```
ψ/lab/citation/worker/
├── worker.js       # ตัวโค้ด — ~80 บรรทัด
├── wrangler.toml   # ตั้งค่า binding, ไม่มี
│                   # account_id (หัวข้อ 10.4)
└── README.md       # อธิบายตัวเอง ครบทุกเคส
                     # ที่เขียนไว้ในบทนี้ด้วย
```

ไม่มี dependency แปลว่าไม่มี `package.json` ไม่มี lock file
ให้ดูแล ไม่มีเวอร์ชันของ library ให้ตามอัปเดต — worker ทั้งตัว
พึ่งแค่ Workers runtime ที่ `wrangler` ให้มาเอง กับ `fetch`/`Response`
ที่เป็น web-standard API อยู่แล้ว นี่คือเหตุผลที่มันยัง "ไฟล์เดียว
80 บรรทัด" ได้อยู่ แม้จะรองรับสาม endpoint พร้อม CORS เต็มรูปแบบ

เปิดด้วยคำสั่งเดียว จาก root ของ repo:

```bash
cd ψ/lab/citation/worker
wrangler dev --port 18787
```

ครั้งแรกต้อง `wrangler login` ก่อนหนึ่งครั้ง (เปิด browser
ให้ authorize) จากนั้นค่อยรัน `wrangler dev` ได้เรื่อยๆ โดยไม่ต้อง
login ซ้ำ session จะอยู่ในเครื่องจนกว่าจะ logout เอง

endpoint ที่ worker เปิดให้มีสามเส้นทางเท่านั้น เขียนไว้เป็น
comment บรรทัดแรกๆ ของไฟล์:

```
POST /embed
  { texts: ["a", "b"] } -> { data: number[][] }
POST /query-embed
  { text: "a query" }   -> { data: number[][] }
GET  /health
  -> { ok: true, model }
```

`/embed` กับ `/query-embed` จริงๆ แล้วโค้ดข้างในรับได้ทั้งคู่แบบ
ยืดหยุ่น — อ่าน `body.texts` ก่อน ถ้าไม่มีค่อยอ่าน `body.text`
แล้วห่อเป็น array เดียวกัน เพราะงั้นต่อให้ยิงผิด field
ไปเส้นทางผิด (เช่นส่ง `text` เดี่ยวไปที่ `/embed`) worker
ก็ยังทำงานถูกอยู่ดี ไม่ใช่ endpoint ที่ตายง่ายเพราะพิมพ์ผิด

โค้ดในปลั๊กอินฝั่ง citation เรียก endpoint นี้ตรงๆ ผ่าน
`CF_EMBED_WORKER_URL` (default ก็คือ `http://localhost:18787`
อยู่แล้ว ไม่ต้องตั้งอะไรเพิ่ม):

```typescript
const LOCAL_WORKER_URL =
  process.env.CF_EMBED_WORKER_URL ||
  "http://localhost:18787";
```

พอ worker รันอยู่ ก็สั่ง index ตามปกติได้เลย ตัว `detectBackend()`
จะไล่เช็ค ollama ก่อน — ถ้า ollama ไม่รันหรือยังไม่มี model
ถึงจะตกลงมาที่ worker เอง ไม่ต้องบอกอะไรเพิ่ม

จุดที่ต้องรู้ไว้คือคำว่า **"shared"** ในคอมเมนต์ของโค้ด — worker ตัวนี้
ไม่ได้ทำมาเพื่อปลั๊กอิน `citation` ตัวเดียว มันคือ worker กลาง
ที่ปลั๊กอินอื่นในตระกูล maw เรียกใช้ร่วมกันได้ ข้อความ error
ตอนหา worker ไม่เจอก็ชี้กลับมาที่ path ใหม่นี้เสมอ (ยกมาแบบ
ตัดบรรทัดจากโค้ดจริง):

```
Local embed worker unreachable at
http://localhost:18787 — start the bundled
one: cd ψ/lab/citation/worker &&
wrangler dev --port 18787
```

พูดง่ายๆ คือถ้ามีคนในทีมเปิด worker ไว้แล้วที่เครื่องเดียวกัน
ไม่ต้องเปิดซ้ำ ใช้ port เดิมได้เลย แต่ถ้าเป็นเครื่องใหม่ที่เพิ่ง
clone repo มา คำสั่งนี้ใช้ได้ตรงๆ โดยไม่ต้องไปหาปลั๊กอินอื่น
ที่อาจจะไม่มีอยู่ในเครื่องเลยด้วยซ้ำ — นี่คือสิ่งที่คอมมิต
`a2b33fc` แก้ไว้: บทนี้ก่อนหน้าเขียนถูกต้องเรื่อง flow ทั้งหมด
แต่ path ที่ชี้ไปเป็น path ที่ใช้ไม่ได้จริงสำหรับคนอื่น

ฝั่ง cf-rest error สั้นกว่านั้นมาก ตรวจแค่ HTTP status
ไม่มีคำแนะนำต่อท้าย:

```typescript
throw new Error(
  `Cloudflare REST embed failed: ${res.status}`
);
```

เจอ error แบบนี้แปลว่าให้เช็คสองอย่างก่อน — `CF_ACCOUNT_ID`
พิมพ์ถูกไหม กับ `CF_API_TOKEN` ยังไม่หมดอายุใช่ไหม
ปกติ token ผิดหรือหมดอายุจะได้ status 401/403 กลับมา
ไม่ใช่ 500 — ถ้าเจอ 500 ปัญหาน่าจะอยู่ที่ฝั่ง Cloudflare เอง
ไม่ใช่ config เรา

## 10.3 ทดสอบจริง: health, embed, และ error ที่ไม่ใช่ stack trace

ตอนย้าย worker เข้ามาใน repo เราไม่ได้แค่ก็อปโค้ดมาวางเฉยๆ
ทดสอบ end-to-end จริงกับ Workers AI ก่อนเขียนบทนี้ สามเคส
ที่เช็คคือ health, embed ปกติ, และ embed ที่ส่ง body ว่าง

`GET /health` เรียกแล้วได้คำตอบตรงตามที่ประกาศไว้:

```bash
curl http://localhost:18787/health
```

```json
{"ok": true, "model": "@cf/baai/bge-m3"}
```

`POST /embed` ส่งข้อความสองอันเข้าไป ได้ vector กลับมาสองแถว
แต่ละแถวยาว 1024 มิติ (ตรงกับที่ ollama ให้เหมือนกัน เพราะ
เป็น model เดียวกัน):

```bash
curl -X POST http://localhost:18787/embed \
  -H 'content-type: application/json' \
  -d '{"texts": ["a", "b"]}'
```

```json
{"data": [[0.01, -0.02, ...], [0.03, 0.00, ...]]}
```

ที่สำคัญกว่าคือเคสที่สาม — ส่ง body ว่างไป (ไม่มี `texts` เลย
ไม่มี `text` เลย) worker ไม่ crash ไม่โยน stack trace กลับมา
ให้ผู้ใช้เห็น แต่ตอบ HTTP 400 พร้อมข้อความที่อ่านรู้เรื่อง:

```bash
curl -X POST http://localhost:18787/embed \
  -H 'content-type: application/json' \
  -d '{}'
```

```json
{"error": "no non-empty text supplied"}
```

โค้ดที่ทำเรื่องนี้อยู่ในไฟล์ `worker.js` ตรงๆ — filter เอา
เฉพาะ string ที่ไม่ว่าง ถ้า filter แล้วเหลือศูนย์ตัว ก็ตอบ 400
ก่อนจะเรียก `env.AI.run()` เลยด้วยซ้ำ:

```javascript
const raw = body.texts ?? body.text;
const texts = (Array.isArray(raw) ? raw : [raw])
  .filter((t) => typeof t === "string"
    && t.length > 0);
if (!texts.length) {
  return cors(Response.json(
    { error: "no non-empty text supplied" },
    { status: 400 },
  ));
}
```

ความตั้งใจตรงนี้คือ ถ้ามีอะไรพังฝั่งเรา (ปลั๊กอินส่ง payload
ผิดรูป) เราอยากรู้ทันทีจาก error message ธรรมดา ไม่ใช่ต้องไล่
อ่าน stack trace ของ Cloudflare Workers runtime ซึ่งอ่านยากกว่า
เยอะ และไม่ได้บอกอะไรที่เกี่ยวกับ input ของเราเลย

สิ่งที่ **ยังไม่ได้ทดสอบแยกเป็นเคส** คือ payload ขนาดใหญ่มากๆ
ในทีเดียว — แต่รู้อยู่แล้วจากประสบการณ์จริงว่า worker ตอบ 500
ถ้า batch ใหญ่เกินไปในคำขอเดียว (56 paper เดี่ยวๆ ผ่าน แต่
paper รวมกับ vault note พร้อมกันแล้วไม่ผ่าน) โค้ดฝั่ง citation
จึงไม่ส่งข้อความทั้งชุดในคำขอเดียว มันตัดเป็นก้อนละ 16 ก่อนเสมอ
ผ่านค่า `CF_EMBED_BATCH`:

```typescript
// The embed worker 500s on a large batch
// (56 papers alone were fine; papers + vault
// notes were not). Chunk the requests so
// corpus size never breaks indexing.
const EMBED_BATCH =
  Number(process.env.CF_EMBED_BATCH) || 16;
```

ถ้า batch ไหนพังกลางทาง error message จะบอกตำแหน่งเป็นช่วง
ไม่ใช่แค่ "พังที่ไหนสักที่" — บอกทั้งดัชนีเริ่ม-จบของ batch นั้น
และความยาวของข้อความที่ยาวที่สุดในก้อนนั้นด้วย เผื่อสาเหตุคือ
text ตัวใดตัวหนึ่งยาวผิดปกติ ไม่ใช่แค่จำนวนตัวเยอะ:

```typescript
throw new Error(
  `embed failed on batch ` +
  `${Math.floor(i / EMBED_BATCH) + 1} ` +
  `(items ${i}–${i + chunk.length - 1}, ` +
  `longest ` +
  `${Math.max(...chunk.map(t => t.length))} ` +
  `chars): ${error instanceof Error
    ? error.message : String(error)}`,
);
```

ค่าเริ่มต้น 16 นี้เดาไม่ได้ล่วงหน้าว่าเหมาะกับทุก corpus
มันเป็นเลขที่ได้จากการลองผิดลองถูกกับ corpus 75 รายการของเรา
เอง — ถ้า corpus ใหญ่กว่านี้มาก หรือแต่ละ summary ยาวกว่านี้มาก
อาจต้องลดค่า `CF_EMBED_BATCH` ลงอีก และยังไม่ได้วัดเวลาตอบสนอง
จริงเทียบกับ ollama อย่างที่บอกไว้ตอนต้นบทด้วยเช่นกัน

## 10.4 account_id ที่ไม่มีโดยเจตนา — และเคสที่เจอเอง

`wrangler.toml` ของ worker ตัวนี้**ไม่มี `account_id` โดยเจตนา**
เขียนคอมเมนต์อธิบายเหตุผลไว้ในไฟล์เลย:

```toml
# No account_id here on purpose. This repo is
# public, and while an account ID is not a
# credential it is still an identifier that
# does not need publishing. wrangler picks the
# account from your own `wrangler login`; if
# you belong to more than one, set
# CLOUDFLARE_ACCOUNT_ID in the environment
# instead.

name = "citation-embed"
main = "worker.js"
compatibility_date = "2024-09-01"

[ai]
binding = "AI"
```

เหตุผลตรงไปตรงมา: repo นี้เป็น public repo account ID เอง
ไม่ใช่ secret แบบเดียวกับ API token — มันเปิดเผยแล้วก็ยังใช้
ทำอะไรกับบัญชีเราไม่ได้โดยตรง แต่มันก็เป็น identifier ที่ไม่มี
เหตุผลต้องเผยแพร่อยู่ดี เก็บให้น้อยที่สุดเท่าที่จำเป็นก็พอ

ผลข้างเคียงของการไม่ใส่ `account_id` คือ — ถ้าเครื่องที่รัน
`wrangler dev` login ไว้ **มากกว่าหนึ่ง account** wrangler
จะไม่รู้ว่าควรเลือกอันไหน แล้วหยุดทำงานทันทีด้วยข้อความนี้:

```
More than one account available but unable to
select one in non-interactive mode.
```

เคสนี้ไม่ใช่สิ่งที่เดาไว้เฉยๆ — เราเจอเองจริงๆ ตอนทดสอบ worker
บนเครื่องที่ login คนละบัญชีไว้สองอัน ก่อนจะรู้ว่าต้องแก้ด้วย
`CLOUDFLARE_ACCOUNT_ID` ทั้งบทนี้ก็เขียนขึ้นหลังเจอ error นี้
ด้วยตาตัวเอง ไม่ใช่คาดเดาจากเอกสารของ Cloudflare

วิธีแก้คือระบุ account ให้ wrangler ชัดๆ ผ่าน environment
variable ก่อนรัน:

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> \
  wrangler dev --port 18787
```

จะรู้ id ของแต่ละ account ได้จาก `wrangler whoami` — คำสั่งนี้
list ทุก account ที่ login ไว้พร้อม id ของมัน คัดลอกอันที่ต้องการ
มาแปะแทน `<your-account-id>` แล้วรันใหม่ได้เลย

**จุดที่ทำให้สับสนบ่อยคือชื่อ env var มีสองชุด ไม่ใช่ชุดเดียว**
— `CLOUDFLARE_ACCOUNT_ID` เป็นของ `wrangler` CLI เอง ใช้แค่ตอน
`wrangler dev` กำลังเลือก account ที่จะรัน worker ให้ ส่วน
`CF_ACCOUNT_ID` กับ `CF_API_TOKEN` (คนละชื่อ ไม่มี `CLOUDFLARE_`
นำหน้า) เป็น env var ที่โค้ด `src/index.ts` ของเราอ่านเองตอน
เลือกทาง cf-rest ทั้งสองชุดไม่เกี่ยวกัน ตั้งชุดหนึ่งแล้วอีกชุด
ยังต้องตั้งแยกอยู่ดี ถ้าจะใช้ทั้ง worker (แบบ multi-account)
และ cf-rest บนเครื่องเดียวกัน

พูดสั้นๆ: ไม่มี `account_id` ใน `wrangler.toml` ไม่ใช่บั๊ก
เป็นการตัดสินใจที่ตั้งใจไว้แล้ว แลกมาด้วย error message ที่
อาจเจอได้บนเครื่องที่ login หลายบัญชี — และมีทางแก้ที่เขียนไว้
ให้แล้วในทั้ง `README.md` ของ worker และในบทนี้

## 10.5 บังคับเลือกด้วย `CITATION_EMBED`

บางทีเราไม่อยากให้มัน auto-detect เอง อยากรู้ชัดๆ ว่ากำลังใช้
backend ไหนอยู่ ตัวแปร `CITATION_EMBED` ทำแบบนั้นได้ — ตั้งแล้ว
`detectBackend()` จะข้ามการเช็ค ollama ไปเลย ใช้ค่านี้ตรงๆ:

```bash
CITATION_EMBED=ollama  ./bin/citation index --vault
CITATION_EMBED=worker  ./bin/citation index --vault
CITATION_EMBED=cf-rest ./bin/citation index --vault
```

ค่าที่รับได้มีสามค่าเท่านั้น: `ollama` `worker` `cf-rest`
แต่ตรงนี้มีจุดที่ต้องระวังจริงๆ — โค้ดไม่ได้ validate ค่าที่ใส่มา
มันแค่ cast type ตรงๆ:

```typescript
const forced =
  process.env.CITATION_EMBED as Backend
  | undefined;
if (forced) return (backendCache = forced);
```

พิมพ์ผิดเป็น `CITATION_EMBED=cloud` เฉยๆ (ไม่ตรงสามค่านี้เป๊ะ)
มันจะไม่ error ทันที — ค่านั้นจะไหลต่อไปถึง `embedTexts()`
ซึ่งเช็คแค่ `backend === "ollama"` ก่อน แล้วค่อยเช็คว่ามี token
REST ไหม ถ้าไม่เข้าเงื่อนไขไหนเลย มันจะตกไปที่ worker
แบบเงียบๆ — ไม่ตรงกับที่เราตั้งใจ เช็คด้วย `citation status`
ทุกครั้งหลังตั้งค่านี้ จะได้เห็นบรรทัด `✓ embeddings: ...`
ยืนยันว่ากำลังใช้ทางไหนอยู่จริง

## 10.6 CORS เปิดกว้าง เพราะหน้า serve คุยกับ Cloudflare ตรงๆ

worker เปิด CORS ให้ทุก origin (`*`) ซึ่งฟังดูหลวมถ้าไม่รู้
บริบท แต่มีเหตุผลเฉพาะเจาะจง — หน้าเว็บ constellation ที่เปิด
ด้วย `citation serve` (บทที่ 12 จะพูดถึง) ยิง query embedding
**ตรงจาก browser** ไม่ผ่าน proxy ฝั่ง server ของเราเลย

```javascript
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods":
    "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "content-type",
};
```

ทุก response (รวมถึงตอน error 400/502) ห่อ header พวกนี้ไว้
เสมอผ่านฟังก์ชัน `cors()` เดียว และมี handler สำหรับ
`OPTIONS` request แยกไว้ต่างหาก เพื่อให้ preflight ที่ browser
ยิงก่อน POST จริงผ่านได้ ถ้าไม่มี handler นี้ browser จะบล็อก
request ตั้งแต่ preflight เลย ไม่ทันได้ถึง `/embed` ด้วยซ้ำ

ข้อดีคือหน้า search ใช้ query embedding ได้ทันทีโดยไม่ต้องพึ่ง
backend ตัวกลาง ข้อเสียคือ endpoint นี้เปิดให้เว็บไหนก็เรียกได้
ถ้ารู้ URL — แต่ worker เองไม่ถือ secret อะไรอยู่แล้ว (ไม่มี
token ไม่มี account credential ที่หลุดออกไปได้ผ่าน request)
สิ่งที่มันทำได้มากที่สุดคือเรียก Workers AI แทนเรา ซึ่งมี
free tier จำกัดปริมาณอยู่ ความเสี่ยงจริงจึงอยู่ที่ "โดนเรียก
เกินโควตาฟรี" มากกว่าเรื่องข้อมูลรั่ว

## 10.7 ข้อควรระวัง: corpus ที่ยังไม่ตีพิมพ์

พูดตรงๆ แบบไม่ตื่นตูม — ข้อความที่ถูกส่งไป Cloudflare ไม่ใช่
ทั้งไฟล์ paper ทั้งหมด (บทที่ 6 อธิบายไว้แล้วว่า embed แค่
`title + summary + thesis_relevance` ต่อ 1 paper) แต่สามตัวนี้
ก็เพียงพอที่จะเป็น "เนื้อความงานวิจัย" ในความหมายที่จับต้องได้
ไม่ใช่แค่ metadata เฉยๆ

ทั้ง worker และ cf-rest วิ่งผ่านเน็ตจริง ต่างจาก ollama ที่ไม่ออก
จากเครื่องเลย — พอ text ออกไปถึง Cloudflare แล้ว มันก็อยู่นอก
การควบคุมของเรา ต่อให้ Cloudflare ลบ log ทันทีตามนโยบาย
เราก็ไม่มีทางพิสูจน์ย้อนหลังได้ว่ามันไม่ถูกเก็บไว้ที่ไหนเลย
นี่คือธรรมชาติของ API ภายนอกทุกตัว ไม่ใช่เรื่องเฉพาะ Cloudflare

ประเด็นคือ **thesis ที่ยังไม่ตีพิมพ์** — claim, hypothesis,
มุมมองต่อ paper คนอื่น สิ่งเหล่านี้ถ้าหลุดออกไปก่อนตีพิมพ์
เอาคืนไม่ได้ (ไม่เหมือนโค้ดที่ revert ได้ใน git) โดยเฉพาะ
คำสั่ง `index --vault` ที่ดึงโน้ตส่วนตัวในวอลต์เข้ามา embed ด้วย
— ต่างจาก index paper เฉยๆ ตรงที่เนื้อหาที่ส่งออกไปเป็นความคิด
ของเราเอง ไม่ใช่บทคัดย่อของ paper คนอื่นที่ตีพิมพ์แล้ว

เราจะไม่บอกว่า "ห้ามใช้ cloud" — เพราะบางสถานการณ์มันคือทางเลือก
เดียวที่มี (เครื่องยืม, ไม่มีสิทธิ์ลง ollama, CI ที่ไม่มี GPU)
แต่เราอยากให้**คนอ่านเป็นคนตัดสินใจเอง** ไม่ใช่ default ที่เผลอ
เปิดใช้โดยไม่รู้ตัว — นั่นคือเหตุผลที่ ollama ถูกเช็คก่อนเสมอ
ในโค้ด และเหตุผลที่บทนี้เขียนคำเตือนไว้ตรงนี้ ก่อนสอนวิธีใช้

ถ้าตัดสินใจว่าจะใช้ cloud จริง สิ่งที่ทำได้คือลดสิ่งที่ embed
ให้เบาลง เช่นเขียน `summary` แบบสั้นพอสรุปประเด็นโดยไม่เปิดเผย
รายละเอียดผลลัพธ์ที่ยังไม่พร้อมเผยแพร่ หรือ index เฉพาะ paper
(ไม่ใส่ `--vault`) แล้วเก็บโน้ตส่วนตัวไว้ index ผ่าน ollama เท่านั้น
— แต่นั่นคือการตัดสินใจของเจ้าของ corpus ไม่ใช่สิ่งที่เครื่องมือนี้
บังคับให้ทำ การมีทาง local อยู่จริงและใช้งานได้เต็มรูปแบบ
คือสิ่งที่ทำให้เรื่องนี้ยังเป็น "ทางเลือก" ไม่ใช่ทางบังคับ

## 10.8 model เดียวกัน แต่ tag ที่เก็บไว้ไม่เดียวกันเสมอ

`manifest.json` เก็บชื่อ model ไว้คู่กับ vector ทุกครั้งที่ index
นี่คือตัวอย่างจริงจากเครื่อง m5 ตอนนี้ (index ผ่าน ollama):

```json
{
  "model": "ollama:bge-m3",
  "dim": 1024,
  "count": 75,
  "updated": "2026-07-25T11:30:39.102Z"
}
```

ทีนี้ ถ้าสลับไปใช้ worker หรือ cf-rest แล้ว index ใหม่ ค่า `model`
จะเปลี่ยนเป็น `cloudflare:@cf/baai/bge-m3` — มาจากฟังก์ชันนี้:

```typescript
async function embedModelId(): Promise<string> {
  const b = await detectBackend();
  return b === "ollama"
    ? `ollama:${OLLAMA_MODEL}`
    : `cloudflare:${EMBED_MODEL}`;
}
```

จุดที่น่าสนใจคือ worker กับ cf-rest ได้ tag **เดียวกัน**
(`cloudflare:@cf/baai/bge-m3`) เพราะทั้งคู่ยิงไปหา model
เดียวกันบน Cloudflare ต่างแค่วิธียืนยันตัวตนอย่างที่บอกไว้
ในหัวข้อ 10.1 — สลับระหว่าง worker กับ cf-rest ไม่ทำให้ tag
ในไฟล์เปลี่ยน แต่สลับจาก ollama ไปทางใดทางหนึ่งใน Cloudflare
(หรือกลับกัน) tag จะเปลี่ยนเสมอ

ตรงนี้ต้องซื่อสัตย์ไว้ก่อน: **เรายังไม่ได้วัด**ว่า vector
จาก `bge-m3` บน ollama กับ `bge-m3` บน Cloudflare Workers AI
ให้ค่าตรงกันแค่ไหน แม้ชื่อ model จะเหมือนกัน แต่คนละ runtime
คนละ build อาจมีเรื่อง quantization หรือ pooling ที่ต่างกันได้
จนกว่าจะวัดจริง เราถือว่ามันเป็นคนละ index family — ห้ามเทียบ
cosine ข้ามกันตรงๆ นี่คือกฎเดิมจากบทที่ 6:
"manifest.json จำชื่อ model — สลับ model ต้อง index ใหม่ทั้งชุด"

จะรู้ได้ยังไงว่า store ที่มีอยู่ตอนนี้ถูกสร้างด้วย backend ไหน
โดยไม่ต้องไปเปิด `manifest.json` เอง — `citation status`
บอกตรงนี้ให้แล้ว แต่ต้องแยกสองบรรทัดออกจากกันให้ถูก เพราะ
มันบอกคนละเรื่อง:

```
✓ embeddings: ollama bge-m3 @
  http://localhost:11434 —
  local, no token, no egress — 1024-dim
✓ store ready (.citation/store) —
  62 paper(s) + 13 vault note(s) ·
  1024-dim · 307 KB · model ollama:bge-m3
```

บรรทัดแรก (`✓ embeddings: ...`) บอกว่า **ถ้าสั่ง index ตอนนี้**
จะใช้ backend ไหน — มาจาก `detectBackend()` สดๆ ทุกครั้งที่เรียก
บรรทัดที่สอง (`✓ store ready ...`) บอกว่า **ของที่มีอยู่แล้ว**
ใน store ถูกสร้างด้วย model tag อะไร — อ่านมาจาก `manifest.json`
ตรงๆ ไม่เกี่ยวกับ backend ที่ detect ได้ตอนนี้เลย

สองบรรทัดนี้**ไม่จำเป็นต้องตรงกัน** — เช่นเคยสลับไปใช้ worker
index ไว้ครั้งหนึ่ง (`model ollama:bge-m3` ในไฟล์เปลี่ยนเป็น
`cloudflare:@cf/baai/bge-m3` ไปแล้ว) แล้วกลับมาเปิด ollama ใหม่
วันนี้ (`embeddings` บอกว่าเป็น ollama) แต่ store ยังเป็น tag
เก่าที่ index ไว้ตอนใช้ worker — พอเจอแบบนี้แปลว่า**ยังไม่ได้
index ใหม่หลังสลับ backend** ต้องรัน `citation index --vault`
อีกรอบก่อนถึงจะตรงกัน นี่คือสัญญาณเตือนตัวที่ต้องเช็คทุกครั้ง
ก่อนเชื่อผลการค้นหา ไม่ใช่แค่ตอนสลับ backend ครั้งแรกเท่านั้น

ข่าวดีคือ `citation index` ไม่ใช่การ append ทีละแถว มันคำนวณ
ทุก paper/note ใหม่หมดแล้วเขียนทับทั้ง `vectors.f32` +
`meta.jsonl` + `manifest.json` ในทีเดียว (ดู `storeWrite()`
ใน `src/index.ts`) เพราะงั้นจะไม่มีทางเกิดไฟล์ที่มี vector
ปนกันสองรุ่นอยู่ในสโตร์เดียว — ความเสี่ยงมีแค่ตอนที่เรา
**เข้าใจผิด**ว่า tag เดิมกับ tag ใหม่เทียบกันได้ ทั้งที่จริง
มันมาจากคนละ backend

## 10.9 `.wrangler/` กับไฟล์ state ที่ไม่ได้ขอ

อีกเรื่องที่เจอตอนทดสอบ ไม่เกี่ยวกับ index หรือ embedding
โดยตรง แต่เกี่ยวกับสุขอนามัยของ repo — พอสั่ง `wrangler dev`
ครั้งแรกในโฟลเดอร์ worker มันสร้างโฟลเดอร์ `.wrangler/` ขึ้นมา
เองโดยที่เราไม่ได้ขอ ข้างในมีทั้ง cache ของ Miniflare (ตัวจำลอง
Workers runtime ตอน dev) และไฟล์หนึ่งที่น่าสนใจกว่าตัวอื่น:

```
ψ/lab/citation/worker/.wrangler/
├── cache/
│   ├── cf.json
│   └── wrangler-account.json
└── state/v3/cache/miniflare-CacheObject/
    ├── metadata.sqlite
    ├── metadata.sqlite-shm
    └── metadata.sqlite-wal
```

`cache/wrangler-account.json` เก็บ account identifier ของ
บัญชีที่ `wrangler dev` เลือกใช้ไว้ — เหตุผลเดียวกับที่เราไม่ใส่
`account_id` ใน `wrangler.toml` ตรงๆ (หัวข้อ 10.4) คือไฟล์นี้
ก็ไม่มีเหตุผลต้อง commit เข้า repo public เหมือนกัน แค่คราวนี้
เป็น tool เองที่สร้างมันขึ้นมาโดยเราไม่ทันตั้งใจ

พอเห็นแล้วก็ใส่เข้า `.gitignore` ทันที ก่อนจะ commit อะไรทับลง
ไปโดยไม่รู้ตัว:

```
# wrangler dev build/state dir for the
# optional embed worker
.wrangler/
```

บทเรียนตรงนี้ไม่ได้จำกัดแค่ wrangler — เครื่องมือหลายตัวสร้าง
ไฟล์ state ที่เราไม่ได้ขอระหว่างรัน (cache, lock file, session
token) นิสัยที่ต้องมีคือ `git status` ก่อน commit ทุกครั้งหลัง
รันเครื่องมือใหม่ที่ยังไม่เคยรันในเครื่องนี้ อย่าเชื่อว่า
`.gitignore` ที่มีอยู่แล้วครอบคลุมของใหม่เสมอ — ต้องมอง diff
จริงก่อนกด commit โดยเฉพาะโฟลเดอร์ที่ไม่คุ้นตา แบบ `.wrangler/`
นี้ ที่ไม่มีใครเขียนมันขึ้นมาเอง แต่ tool เขียนให้แทน

## 10.10 สลับกลับมา local

พอเลิกใช้ cloud แล้ว กลับมา ollama ทำได้ไม่กี่ขั้น ไม่ต้องแก้โค้ด
เลย เพราะ ollama คือค่า default อยู่แล้วในลำดับ auto-detect:

```bash
unset CITATION_EMBED
ollama pull bge-m3   # ถ้ายังไม่เคย pull มาก่อน
./bin/citation status  # เช็คว่าเห็น ollama ไหม
./bin/citation index --vault  # index ใหม่ทั้งชุด
```

คำสั่ง `status` จะโชว์บรรทัด embeddings บอกชัดว่ากำลังใช้ทางไหน
อยู่ — ถ้ากลับมา local สำเร็จ จะเห็นแบบนี้:

```
✓ embeddings: ollama bge-m3 @
  http://localhost:11434 —
  local, no token, no egress — 1024-dim
```

ไม่มี token ค้าง ไม่มี worker ต้องปิด ไม่มี state อะไรทิ้งไว้ที่
เครื่องอื่น — index ทั้งชุดแค่ 8.4 วินาทีตามที่วัดไว้ในบทที่แล้ว
กลับมาแล้วก็เหมือนไม่เคยออกจากบ้านเลย ถ้าเคยเปิด `wrangler dev`
ทิ้งไว้ระหว่างสลับ ก็แค่ `Ctrl-C` ปิด process นั้น ไม่มีอะไรต้อง
ทำความสะอาดเพิ่มนอกจากนี้ (โฟลเดอร์ `.wrangler/` จากหัวข้อก่อน
หน้าอยู่ต่อในเครื่องได้ ไม่กระทบอะไร เพราะไม่ได้ถูก commit)

corpus 62 ใบยังเล็กพอที่จะ index ใหม่ทั้งชุดทุกครั้งที่สลับ
backend โดยไม่รู้สึกเสียเวลา — นี่คือเหตุผลที่เราไม่รีบทำ
incremental index ให้ซับซ้อนขึ้น ของเล็กแค่นี้ ทำใหม่ทั้งชุด
ยังเร็วกว่าคิด logic merge vector จากคนละ model ให้ถูกต้อง

สรุปสั้นๆ ก่อนปิดบท: cloud มีให้ใช้จริง เปิดง่าย ไม่ต้องมี token
ใหม่ถ้าใช้ worker แต่ทุกครั้งที่ใช้ ข้อความจาก corpus จะออกจาก
เครื่องเรา — ตัดสินใจเองว่าคุ้มไหมสำหรับ paper ใบนั้น (หรือโน้ต
ในวอลต์ ถ้าใช้ `--vault`) แล้วอย่าลืมเช็คว่า `manifest.json`
เปลี่ยน tag ตามที่คาดไว้จริง ผ่าน `citation status` สองบรรทัด
ที่บอกไว้ในหัวข้อ 10.8 — บรรทัด embeddings บอกทางที่จะใช้
บรรทัด store บอกทางที่เคยใช้ไปแล้ว ทั้งสองต้องตรงกันก่อนเชื่อ
ผลค้นหา

ทางเดินของ index จบอยู่ตรงนี้ — local, CPU, Apple Silicon,
cloud ครบทั้งสี่แบบที่มีจริง สิ่งที่เหลือคือวันที่ไม่มีทางไหน
เลย ไม่มีเน็ต ไม่มีปลั๊กเสียบ มีแค่โน้ตบุ๊กกับแบตที่เหลือน้อยลง
ทุกนาที — บทถัดไปพูดเรื่องนั้นตรงๆ
