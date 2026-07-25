# บทที่ 8: Index ด้วย CPU — เครื่องไม่มี GPU ทำยังไง

เครื่องที่วัดเลขในเล่มนี้คือ m5 — GPU เต็มก้อน ไม่เคยตกไป CPU บทนี้จึง
ไม่มีเลข "X วินาทีบน CPU" ให้อ้าง มีแต่วิธีวัดเอง เช็คการตกไป CPU และ
ลด batch เมื่อ RAM น้อย

## 8.1 ollama บน CPU — ทำงานได้ ช้ากว่า ไม่ error

ไม่มี GPU (Metal/CUDA/ROCm) ollama สลับไปรัน CPU เงียบๆ ไม่มีคำเตือน —
`ollama pull bge-m3` ทำงานเหมือนเดิม แค่ embed ช้ากว่า

- GPU = core เล็กจำนวนมาก ทำ matrix multiplication ขนานหลักพัน — ตรงกับ
  embedding พอดี
- CPU = core น้อยกว่ามาก ต้องเรียงคิวแทนขนาน — core เยอะแค่ไหนก็ยังห่าง
  จากหลักพัน-หมื่นของ GPU
- ตัวเลขจริงขึ้นกับ CPU gen + instruction set (AVX2/NEON) — วัดเอง

หมายเหตุ: ความเร็ว `ollama pull` วัดจาก**ความเร็วเน็ต** — คนละปัญหากับ
ความเร็ว index

## 8.2 เช็คว่าตกไป CPU จริงไหม — size_vram vs size

```bash
curl -s http://localhost:11434/api/ps | jq .
```

```json
{
  "models": [
    {
      "name": "bge-m3:latest",
      "size": 665398500,
      "size_vram": 665398500,
      "context_length": 8192
    }
  ]
}
```

| size_vram เทียบ size | แปลว่า |
|---|---|
| `size_vram == size` | resident GPU เต็มก้อน — m5 เป็นแบบนี้ (634 MB, 100%) |
| `size_vram < size` | บางส่วน GPU บางส่วนตก CPU — VRAM ไม่พอโหลดทั้งก้อน |
| `size_vram` = 0 หรือไม่มี field | CPU ล้วน ไม่มี GPU ช่วยเลย |

`maw citation status` เช็คให้อัตโนมัติ:

```
  ✓ hardware: Apple M5 Max · arm64 · 18 cores · 128 GB — Metal GPU available
  ✓ embeddings: ollama bge-m3 @ http://localhost:11434 — 1024-dim
      └ bge-m3:latest · 634 MB · 100% GPU (fully resident) · 8192 ctx
```

เจอ `⚠ partly on CPU` หรือ % ต่ำกว่า 100 = พึ่ง CPU จริง ไม่ต้องเดา

หมายเหตุ: residency เช็คได้**หลัง**embed แล้วเท่านั้น — เรียก `status`
ก่อน embed บรรทัดนี้หายไปเฉยๆ ไม่ใช่ error

ดูสดระหว่าง index:

```bash
watch -n 2 'curl -s http://localhost:11434/api/ps | jq .'
```

ไม่อยากพึ่ง `jq`:

```bash
ollama ps    # คอลัมน์ PROCESSOR บอกสัดส่วน GPU/CPU ตรงๆ
```

คำนวณ % เอง:

```bash
curl -s http://localhost:11434/api/ps \
  | jq '.models[] | {name, pct: ((.size_vram // 0) / .size * 100 | round)}'
```

## 8.3 จับเวลา index ของตัวเอง

```bash
time maw citation index --vault
```

```
real    0m??.???s
user    0m??.???s
sys     0m0.???s
```

| บรรทัด | ความหมาย |
|---|---|
| `real` | เวลารอจริง (นาฬิกาผนัง) — เลขที่เทียบข้ามเครื่องได้ (m5 GPU = 8.4s) |
| `user` | เวลา CPU รวมทุก core — CPU-only อาจ**มากกว่า** `real` ถ้าขนานหลาย thread |
| `sys` | เวลาคุยกับ OS (อ่านไฟล์ เปิด socket) — ปกติน้อยมาก |

รอบแรก (cold) รวมเวลาโหลดโมเดล รอบสอง (warm) สะท้อนการคำนวณจริงกว่า —
จดแยกบรรทัด

ปิดโปรแกรมหนักๆ ก่อนวัด วัดซ้ำ 3 รอบ เอาค่ากลาง (median) — ครั้งช้า
ผิดปกติอาจเป็น throttle หรือโปรแกรมอื่นแทรก:

```bash
for i in 1 2 3; do
  { time maw citation index --vault; } 2>> index-timing.log
done
```

โน้ตบุ๊คไร้พัดลมอาจเจอ thermal throttling — รอบท้ายช้ากว่ารอบต้น ไม่ใช่
bug พักเครื่องให้เย็นแล้ววัดใหม่

จดผลไว้ที่หาเจอทีหลัง เช่น
`"index --vault บนเครื่อง X: cold Ns / warm Ns, size_vram=0%"`
— ใช้เป็น baseline

อยากเทียบ GPU vs CPU: ปิด GPU acceleration ชั่วคราว (env var ที่ ollama
อ่าน บังคับ CPU-only) แล้ว `time` ซ้ำเทียบกัน

## 8.4 RAM น้อย — ลด CF_EMBED_BATCH

ตัวช้ามีสองแบบ — **ไม่มี GPU** (แก้ด้วย GPU/backend อื่น) กับ **RAM
ไม่พอ** (swap หนัก ค้างหรือ error 500 แก้ด้วยลด batch) แก้ผิดทางไม่ช่วย

embed ส่งเป็น batch ค่า default 16 คุมด้วย `CF_EMBED_BATCH` (ชื่อ CF
จากยุค backend แรกคือ Cloudflare แต่คุมทุก backend รวม ollama ด้วย):

```bash
CF_EMBED_BATCH=8 maw citation index --vault
```

batch เล็กลง → tensor ค้างใน RAM น้อยลง แลกกับรอบมากขึ้น (75 รายการ
batch 8 ≈ 10 รอบ แทน ~5) เวลารวมไม่ต่างมาก แต่เสถียรขึ้น

ยังไม่พอ ไล่ลดครึ่งต่อครึ่ง: `16 → 8 → 4 → 2 → 1` — ที่ 1 ยิงทีละรายการ
แทบไม่ error แต่ overhead สูงสุด ไม่ตั้งเป็น default เพราะกินเวลามากขึ้น
ถ้า RAM พออยู่แล้ว — ปรับจนกว่า index จะรันจบโดยไม่ error

| อาการ | ลองทำ |
|---|---|
| index ค้างนาน ไม่มี error | ปกติสำหรับ CPU-only — รอ หรือวัดเวลาไว้ |
| `500` กลางทาง | ลด `CF_EMBED_BATCH` |
| เครื่องแค้ก / swap เยอะ | ลด `CF_EMBED_BATCH` เพิ่ม |
| `no embedding backend reachable` | ollama ไม่ได้รันอยู่ — `ollama serve` |

## 8.5 คอร์ปัส 62 ใบ ไม่ใช่ 62,000 ใบ

คอร์ปัส 62 paper + 13 vault note = 75 รายการ embed แค่ 3 ฟิลด์สั้นๆ
ต่อรายการ store ทั้งชุด 452 KB — CPU ช้ากว่า GPU สิบยี่สิบเท่า ก็จบใน
ไม่กี่นาที ไม่ใช่ชั่วโมง

เครื่องไม่มี GPU ไม่ใช่ข้ออ้างไม่เริ่ม — แค่รอนานกว่าเดิม

## 8.6 ตอนไหนควรยอมใช้ cloud แทน

สัญญาณ: `real` นานเกินคาด (สิบนาทีสำหรับ 75 รายการ), ลด `CF_EMBED_BATCH`
ถึง 1 แล้วยัง error, หรือ RAM แทบไม่พอโหลดโมเดล — สลับ backend เป็น
cloud (Cloudflare Workers AI รันโมเดลเดียวกัน `@cf/baai/bge-m3`):

```bash
CITATION_EMBED=worker maw citation index --vault
```

ข้อควรคิดก่อนกด: ข้อความที่ส่งไป (title/summary/thesis_relevance ของ
วิทยานิพนธ์ที่ยังไม่ตีพิมพ์) ออกจากเครื่องแล้วเอาคืนไม่ได้ — เลือกอย่าง
รู้ตัว ไม่ใช่เพราะขี้เกียจรอ รายละเอียด `worker` vs `cf-rest` อยู่บทที่ 10
