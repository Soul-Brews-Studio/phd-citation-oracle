# เริ่มที่นี่

หน้านี้แทนคำนำทั้งเล่ม — เปิดมาแล้วรันได้เลย ไม่ต้องอ่านอะไรก่อน

```bash
git clone https://github.com/Soul-Brews-Studio/phd-citation-oracle
cd phd-citation-oracle
./bin/citation status   # เช็คทุกชิ้นส่วนก่อนเสมอ — รันก่อนทุกครั้ง
```

corpus ตัวอย่างในเล่มนี้คือ paper PM2.5 62 ใบ — corpus ของคุณเป็น
topic อื่นก็ใช้ได้ กลไกเดิมทุกจุด แค่เปลี่ยนเนื้อการ์ด

## 8 คำสั่ง เรียงตามลำดับที่ใช้จริง

| ลำดับ | คำสั่ง | ทำอะไร |
|---|---|---|
| 1 | `status` | เช็คว่าทุกชิ้นส่วนพร้อมไหม |
| 2 | `cards` | JSONL → การ์ด markdown 1 ใบ/paper (idempotent) |
| 3 | `doi` | ถาม Crossref หา DOI + ผู้แต่งจริง (default = dry run) |
| 4 | `bib` | การ์ด → `.bib` พร้อมใช้ใน LaTeX |
| 5 | `index` | embed การ์ดเข้า vector store |
| 6 | `search` | ค้นความหมาย ไม่ใช่ค้นคำ |
| 7 | `serve` | เปิดแผนที่ดาวแบบ interactive (localhost) |
| 8 | `graph` | render แผนที่ดาวเป็น PNG/SVG |

จากศูนย์ถึงมี `.bib` พร้อมส่งวิทยานิพนธ์ — 9 ขั้น (`doi` รัน 2 รอบ):

```bash
./bin/citation cards
./bin/citation doi                    # dry run — ดูก่อนเชื่อ
./bin/citation doi --write --rekey    # พอใจแล้วค่อยเขียนจริง
./bin/citation bib
./bin/citation index --vault          # --vault พ่วง vault notes
./bin/citation search "PM2.5 satellite AOD Thailand"
./bin/citation graph                  # หรือ ./bin/citation serve
```

## อ่านต่อตรงไหน

| อยากได้ | ไปบท |
|---|---|
| เริ่มใช้เลย ลงมือคำสั่งแรก | บทที่ 2, 5 |
| กลไกข้างใน — embedding, vector store คืออะไร | บทที่ 6 |
| ทำ research จริง — brief → GPT/Gemini → verify | บทที่ 12-15 |

## ข้อควรระวัง

ตัวเลข sensor/ความเชื่อมั่นที่โผล่มาเป็น context เป็นงานยังไม่ตีพิมพ์
ของเจ้าของ corpus ตัวอย่าง ห้ามอ้างเป็นผลวิจัยที่ยืนยันแล้ว

เลขเวลา index ทุกตัวในเล่มวัดบนเครื่อง m5 (Apple M5 Max) เท่านั้น
เครื่องไม่มี GPU เรายังไม่ได้วัด — บทที่ 8 สอนวิธีวัดเอง ไม่มีเลขให้อ้างอิง

ฉบับยาว 170 หน้า มีแยกเล่ม ถ้าอยากอ่านคำอธิบายละเอียดของแต่ละคำสั่ง
