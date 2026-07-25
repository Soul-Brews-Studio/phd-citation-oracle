# บทที่ 7: Index แบบ Local — ollama บนเครื่องเรา

คำสั่ง pull model, serve, index --vault บน ollama local — เวลาวัดจริงบน m5
(Apple M5 Max, arm64, 18 cores, 128 GB unified memory), ค่า batch, ตาราง
troubleshoot

## 7.1 ทำไม local เป็น default

corpus ยังไม่ตีพิมพ์ — `thesis_relevance` คือ argument ที่ยังไม่เผยแพร่
default จึงต้อง **ไม่ออกเน็ต** เสมอ

| ลำดับ | backend | ต้องมีอะไร | ออกเน็ตไหม |
|---|---|---|---|
| 1 | ollama (local) | pull bge-m3 + ollama serve | ไม่ออก ← default |
| 2 | Cloudflare worker `:18787` | wrangler login เดิม | ออก ผ่าน worker |
| 3 | Cloudflare REST | `CF_ACCOUNT_ID` + `CF_API_TOKEN` | ออก ตรง REST |

พอ ollama พร้อม ระบบเลือกเองทันที ไม่ต้อง token/account/ต่อเน็ต cloud เป็น
ตัวสำรอง เปิดใช้เมื่อไม่มี GPU หรือ ollama ล่ม

`thesis_relevance` คือการตีความว่า paper ค้ำ claim ไหน — บาง paper ยังเป็น
preprint ส่งออกนอกเครื่องเท่ากับส่งข้อมูลคนอื่นไปด้วย

ระบบไล่บนลงล่าง เจอ ollama ที่พร้อมก็หยุด บังคับ backend ตรงๆ ได้เช่นกัน:

```bash
CITATION_EMBED=ollama   ./bin/citation index --vault
CITATION_EMBED=worker   ./bin/citation index --vault
CITATION_EMBED=cf-rest  ./bin/citation index --vault
```

## 7.2 pull model + serve

ดึง model ครั้งเดียว อยู่บนดิสก์ตลอด ไม่ต้องดึงซ้ำ:

```bash
ollama pull bge-m3
# ครั้งแรกดาวน์โหลดประมาณ 1.2 GB — วัดจากการ pull จริง
# บน m5 ไม่ใช่เลขจากเอกสารของ ollama เอง
```

ต้องมี ollama รันเบื้องหลัง ถึงจะรับ request embed ได้:

```bash
ollama serve
# macOS ปกติมี background service รันเองอยู่แล้ว ไม่ต้องสั่งเอง
# ต้องสั่งเองเมื่อ install แบบ manual หรือรันบน CI
```

bge-m3 = ตัวเดียวที่ citation ใช้ (multilingual, 1024 มิติ) ไทย/อังกฤษอยู่
vector space เดียวกัน embed ต่อ paper คือ title+summary+thesis_relevance
เท่านั้น ไม่ใช่ทั้งการ์ด

ฟิลด์อย่าง `doi` `volume` `pages` ไม่ถูก embed — เติม `doi` ทีหลังได้
ไม่ต้อง index ใหม่ทั้งชุด

`--vault` embed vault note จาก `ψ/memory/{learnings,retrospectives,resonance}`
และ `ψ/writing/research` ด้วย ติด tag `kind: note` — search เจอทั้งสองแบบ
พร้อมกัน

## 7.3 รันจริง — 75 รายการ 8.4 วินาที

```bash
./bin/citation index --vault
```

| รายการ | ค่าที่วัดจริงบน m5 |
|---|---|
| จำนวนที่ index | 75 (62 paper + 13 note) |
| เวลา index --vault | 8.4 วินาที |
| เวลา search 1 ครั้ง | 0.221 วินาที |
| ขนาด store ทั้งโฟลเดอร์ | 452 KB |
| ขนาด `vectors.f32` | 300 KB |
| bge-m3 ใน VRAM | 634 MB · ctx 8192 · 100% GPU |

เงื่อนไข: model ต้อง warm ใน GPU อยู่แล้ว (ครั้งแรกหลังเครื่องว่างนาน
เสียเวลาโหลด VRAM เพิ่ม) เฉลี่ยวินาทีละ 9 รายการ — เร็วพอสั่งซ้ำบ่อยๆ ได้

search คือ embed คำถามแล้วเทียบ cosine กับ 75 แถวแบบ brute-force เขียนล้วน
ด้วย TypeScript — เล็กเกินกว่าต้องใช้โครงสร้างซับซ้อน:

```
[0.7913] 📄 paper \cite{mahajan2025}
  (low-cost-sensor-calibration)
  Mahajan & Helbing (2025)
[0.8702] 📝 note (ψ/writing/research)
  Environmental prediction models for PM2.5
```

📄 คือ paper 📝 คือ note ตัวเลขในวงเล็บคือ cosine similarity ยิ่งใกล้ 1
ยิ่งใกล้เคียงคำถาม — ทั้งสองแหล่งอยู่ vector space เดียวกัน

store บนดิสก์ = 3 ไฟล์ธรรมดา ไม่ใช่ database: `vectors.f32` (75 × 1024
float32) `meta.jsonl` (metadata) `manifest.json` (ชื่อ model) — สลับ model
ต้อง index ใหม่ทั้งชุด ลบทิ้งได้เสมอ เป็น derived data ล้วนๆ

## 7.4 batch 16 — เคสยิงทีเดียวหมดแล้วพัง

embed ไม่ส่งทีละ paper — ส่งเป็นชุดๆ ชุดละ 16 คุมด้วย env var:

```bash
CF_EMBED_BATCH=16   # ค่า default
```

ตอน corpus มีแค่ 56 paper ยิงทีเดียวยังผ่าน พอรวม note ทะลุ 65 รายการ
เริ่มพัง — worker ตอบ error 500 ตรงๆ ไม่ว่าจะเพราะ payload limit หรือ
timeout ฝั่ง worker ผลที่เห็นคือ 500 เหมือนกัน

ทางแก้: หั่นชุดละ 16 รอผลก่อนส่งชุดถัดไป (75 รายการ = 5 รอบ) เป็น
default อยู่แล้ว RAM น้อยหรือ backend limit ต่ำกว่า 16 ลด batch ได้ตรงๆ:

```bash
CF_EMBED_BATCH=8  ./bin/citation index --vault
```

batch เล็กลง = รอบส่งเยอะขึ้น ช้านิดหน่อย แต่ request เบาลง ปรับได้ทันที
แค่ตั้ง env var บทเรียน: อย่ายิงทีเดียวหมด — 65 รายการก็พังได้ถ้าไม่หั่น
batch

## 7.5 troubleshooting

ส่วนใหญ่ที่เจอ คือ ollama ยังไม่รัน หรือรันแล้วแต่ยังไม่ pull `bge-m3`:

| อาการ | สาเหตุที่พบบ่อย | วิธีแก้ |
|---|---|---|
| `no embedding backend reachable` | ollama ไม่ได้รันอยู่ หรือรันแล้วแต่ยังไม่ pull `bge-m3` | `ollama serve` แล้ว `ollama pull bge-m3` |
| embed error กลางทาง (error 500) | corpus รวมทะลุ ~65 รายการ แล้วยังยิง batch เดียวทั้งชุด | ลด `CF_EMBED_BATCH=8` |
| `nothing indexed yet` / search ว่างเปล่า | ยังไม่เคยรัน `index --vault` เลย store จึงยังไม่มี | รัน `./bin/citation index --vault` ก่อน search |

เช็คทีละขั้น เริ่มจากถามว่า ollama รันอยู่จริงไหม:

```bash
curl -s http://localhost:11434/api/tags
# connection refused = ollama ไม่ได้รันอยู่ → ollama serve
# list ว่าง/ไม่มี bge-m3 → ollama pull bge-m3
```

เช็คว่า model ขึ้น GPU จริงไหม ด้วย `/api/ps`:

```bash
curl -s http://localhost:11434/api/ps
# size == size_vram → resident เต็มก้อนบน GPU (100%, ไม่มี CPU fallback)
```

ollama unload model เองหลังไม่ใช้งาน ~5 นาที (เช็คจาก `expires_at` ใน
`/api/ps`) — index รอบแรกของวันช้ากว่านิดหน่อยเพราะ warm กลับ VRAM ไม่ใช่
อาการพัง ยืนยันด้วย `size` vs `size_vram` ไม่ใช่เดาจากความรู้สึก

ถ้าเช็คครบแล้วยัง `no embedding backend reachable` บังคับด้วย
`CITATION_EMBED=ollama` จะเห็น error ชัดกว่าเดิม เทียบ backend ที่ 2 ตอน
ดีบัก เปิดคู่กันได้ด้วย wrangler ที่ล็อกอินไว้แล้ว:

```bash
cd ~/.maw/plugins/cf-embed/worker
wrangler dev --port 18787
```

ใช้เฉพาะตอนดีบักหรือเครื่องไม่มี GPU จริงๆ — ollama ปกติดี ไม่ต้องเปิด
worker คู่ เท่ากับส่งข้อความออกเน็ตโดยไม่จำเป็น

## ปิดท้าย

ไม่ต้องมีเน็ตเลย: `index` `search` `serve` `graph` `bib` `cards` `status`
— ที่ต้องมีเน็ตจริงมีแค่ `doi` (ยิง `api.crossref.org` ยืนยัน DOI) ยิงทีละ
ใบด้วย `citation doi <citekey>` ต่อเน็ตผ่าน tethering ควอต้าจำกัดก็ยังทำได้

ตัวเลขทั้งบทนี้วัดบนเครื่องที่มี GPU พร้อมอยู่แล้ว — m5 เป็น Apple
Silicon unified memory ให้ CPU กับ GPU ใช้ RAM ก้อนเดียวกัน ไม่ต้องคัดลอก
ข้ามไปมาแบบ discrete GPU

index บนเครื่องที่ไม่มี GPU เลย ใช้เวลากี่วินาที **ยังไม่ได้วัด** สักครั้ง
ทั้งบนเครื่องที่ปิด GPU ทดสอบ และเครื่อง Intel/AMD ทั่วไป
