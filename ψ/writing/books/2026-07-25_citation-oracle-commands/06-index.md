# บทที่ 6: Index คืออะไร ทำไมต้องทำ

Index = แปลงข้อความแต่ละ paper เป็นเวกเตอร์ 1024 มิติ เก็บไว้ค้นด้วย cosine similarity บทนี้บอกว่า embed อะไร เก็บที่ไหน เร็วแค่ไหน และตอนไหนต้องทำใหม่

## 6.1 embed คืออะไร

โมเดล **bge-m3** — ป้อนข้อความเข้า คายตัวเลข **1024 มิติ** ออก ทุก paper ขนาดเท่ากันเป๊ะไม่ว่ายาวแค่ไหน

- multilingual — ไทยกับอังกฤษอยู่ใน vector space เดียวกัน
- ค้นเป็นไทยเจอ paper ภาษาอังกฤษได้เลย ไม่ต้องแปลก่อน

## 6.2 อะไรถูก embed — ไม่ใช่ทั้งไฟล์

**เฉพาะ 3 ฟิลด์ต่อกัน**: `title + summary + thesis_relevance`

```typescript
// The text we embed per paper: title carries the topic,
// summary + relevance carry the semantic meat that makes
// similarity meaningful.
function paperText(p: Paper): string {
  return [p.title, p.summary, p.thesis_relevance]
    .filter(Boolean)
    .join("\n\n");
}
```

**ไม่ถูก embed**: `doi`, `volume`, `pages`, `journal` — metadata ล้วน ไม่มีเนื้อความให้ตีความ

ผลตามมา: เติม `doi` เข้าการ์ด **ไม่ต้อง index ใหม่** เพราะไม่ได้อยู่ใน `paperText()` ตั้งแต่แรก

vault note ก็ถูก embed ด้วยถ้าเรียก `index --vault` — ดึงจาก `ψ/memory/{learnings,retrospectives,resonance}` และ `ψ/writing/research`:

```bash
# index ทั้ง paper และ vault note ในรอบเดียว
maw citation index --vault
```

ผลลัพธ์ปนกัน แยกด้วยไอคอน 📄 paper / 📝 note:

```
  [0.7913] 📄 paper \cite{mahajan2025}
           (low-cost-sensor-calibration)
           Mahajan & Helbing (2025)
  [0.8702] 📝 note (ψ/writing/research)
           Environmental prediction models for PM2.5
```

## 6.3 cosine similarity

วัด**มุม**ระหว่างเวกเตอร์สองแถว ไม่ใช่ระยะห่าง — ชี้ทางเดียวกันเป๊ะ = 1.0, ตั้งฉาก = 0, ค่าติดลบแทบไม่เจอในทางปฏิบัติ

ทำไมใช้มุมไม่ใช่ระยะทาง: เอกสารยาว/สั้นให้เวกเตอร์ "ยาว" ไม่เท่ากัน มุมตัดปัญหานั้นทิ้ง เหลือแต่ทิศทาง

ก่อนเทียบต้อง **normalise** เวกเตอร์ทั้งสองฝั่งก่อน (หารด้วยความยาวตัวเอง) เพราะ backend ที่ใช้ไม่ normalise มาให้

## 6.4 ทำไม brute force พอ — ไม่ต้องมี ANN index

Brute force = วน**ทุกแถว**คำนวณ cosine ตรงๆ ไม่มี index พิเศษช่วยข้าม (ต่างจาก ANN ของ Pinecone/FAISS/LanceDB ซึ่งเร็วกว่าแต่ approximate + ต้องมี native dependency)

**ตัวเลขจริงที่วัด**: corpus 75 แถว ค้น 1 ครั้ง (embed query + brute-force cosine ทั้ง 75 แถว) = **0.221 วินาที**

```bash
# ตัวอย่าง search ที่วัดเวลาไว้
time maw citation search "tmux mouse paste"
# real  0m0.221s
```

| ขนาด corpus | brute force | ต้อง ANN ไหม |
|---|---|---|
| 75 แถว (ตอนนี้) | 0.221 วิ | ไม่ต้อง |
| หลักพัน | คาดว่าเร็วพอ (ยังไม่ได้วัด) | ยังไม่ต้อง |
| หลักล้าน | ช้าลงชัดเจน | ต้องคิดเรื่อง ANN |

corpus PhD ไม่มีทางโตถึงหลักล้าน — 56 paper + note รวม 75 แถว โตขึ้น 10 เท่าก็ยังสบาย แลกกับไม่มี native dependency, ไม่ต้อง compile พิเศษ, แม่นยำ 100% ไม่มี approximate

## 6.5 store คือไฟล์ธรรมดา ไม่มี database

ไม่มี SQLite ไม่มี Postgres — เก็บเป็นไฟล์ธรรมดา 3 ไฟล์ในโฟลเดอร์เดียว:

```
vectors.f32     # N × 1024 Float32 เรียงต่อกันเป็นแถวดิบ
meta.jsonl      # 1 บรรทัด = 1 paper/note — citekey, title, kind, ...
manifest.json   # { model, dim, count, updated }
```

`vectors.f32` ไม่มี label ปนอยู่เลย — รู้ว่าแถวที่ 5 คือ paper ไหนจาก `meta.jsonl` บรรทัดที่ 5 (ผูกกันด้วยลำดับ ไม่ใช่ key)

`manifest.json` จำ model + dimension + count + updated — **กลไกป้องกันความผิดพลาดสำคัญที่สุด** เพราะเวกเตอร์คนละ model เทียบกันไม่ได้แม้มิติเท่ากัน สลับ model แล้วเทียบแถวเก่ากับใหม่ปนกัน = ผลลัพธ์ผิดแบบเงียบๆ ไม่มี error เตือน

**ขนาดจริงบนดิสก์**: ทั้งโฟลเดอร์ **452 KB** สำหรับ 75 รายการ — `vectors.f32` กิน **300 KB** (75 × 1024 × 4 byte) ที่เหลือคือ text ล้วน

```bash
# derived data ล้วนๆ — ลบทิ้งได้เลยแล้ว index ใหม่ ไม่มีอะไรพัง
rm -rf artifacts/index/
maw citation index --vault
```

## 6.6 ตารางตัดสินใจ — ตอนไหนต้อง index ใหม่

| ทำอะไร | ต้อง index ใหม่ไหม | เพราะอะไร |
|---|---|---|
| เติม `doi` ในการ์ด | **ไม่ต้อง** | doi ไม่ถูก embed |
| เติม `volume`, `pages` | **ไม่ต้อง** | metadata ล้วน ไม่ถูก embed |
| แก้ `title` | **ต้อง** | อยู่ใน `paperText()` โดยตรง |
| แก้ `summary` | **ต้อง** | อยู่ใน `paperText()` โดยตรง |
| แก้ `thesis_relevance` | **ต้อง** | อยู่ใน `paperText()` โดยตรง |
| เพิ่ม paper ใหม่เข้า corpus | **ต้อง** | ยังไม่มีแถวของมันใน store |
| เขียน vault note ใหม่ | ต้อง ถ้าอยาก search เจอ | ใช้ `index --vault` |
| สลับ embedding model | **ต้อง index ใหม่ทั้งชุด** | vector คนละ space เทียบกันไม่ได้ |
| ลบโฟลเดอร์ store ทิ้ง | ต้อง (แต่ไม่มีอะไรพัง) | derived data สร้างใหม่ได้เสมอ |

กฎสั้นๆ: แก้ฟิลด์ที่**อยู่ใน** title / summary / thesis_relevance → ต้อง index ใหม่ แก้ฟิลด์อื่นทั้งหมด → ไม่ต้อง

## ข้อจำกัดที่ต้องรู้ — bge-m3 บอก keyword ให้ไม่ได้

Search คืน similarity 0.7913 มา — bge-m3 เป็น black box ตอบไม่ได้ว่า "ใกล้กันเพราะคำไหน" ความหมายกระจายอยู่ทั่ว 1024 มิติ แกะย้อนกลับไม่ได้

หน้า serve จึงโชว์ **term overlap ถ่วงน้ำหนักด้วย IDF** แทน แปะป้ายชัดว่าเป็น**หลักฐานประกอบ ไม่ใช่สาเหตุ** — ไม่ใช่ "โมเดลจับคู่เพราะคำนี้" แต่คือ "คำเหล่านี้ปรากฏร่วมกันด้วย ลองดูเป็นเบาะแส"
