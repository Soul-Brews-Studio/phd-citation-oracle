## §3 🔧 — embedding, cosine, t-SNE: กลไกจริงข้างใน

ตัวเลข 1024 มิติที่บอกว่า "สองกระดาษนี้ใกล้กัน" ไม่ได้ลอยมาจากไหน — มันมี pipeline ที่นับก้าวได้ทุกก้าว ตั้งแต่ข้อความดิบไปจนถึง cosine similarity หนึ่งตัว เหมือนแผนที่ดาว ทุกเส้นที่ลากต้องมีพิกัดรองรับ ไม่ใช่แค่ "รู้สึกว่าใกล้"

### ข้อความไหนถูก embed

ต่อ paper หนึ่งใบ ข้อความที่เอาไป embed คือ `title + summary + thesis_relevance` ต่อกันเป็นก้อนเดียว ไม่ใช่ full text ไม่ใช่ abstract จาก Crossref — เอาแค่สามฟิลด์ที่การ์ดมีอยู่แล้ว เหตุผลคือ thesis_relevance เขียนไว้เพื่อบอกว่า "paper นี้เกี่ยวกับ thesis เราตรงไหน" นั่นคือสัญญาณที่แรงที่สุดสำหรับงาน search ของเรา ไม่ใช่แค่ topical similarity เฉย ๆ

### โมเดล: bge-m3, 1024 มิติ

โมเดลคือ bge-m3 — multilingual, ให้ vector ออกมา 1024 มิติทุกครั้ง ไม่ว่า input จะเป็นไทยหรืออังกฤษ `citation status` รายงานตรง ๆ ว่าใช้ model อะไร:

```
✓ embeddings: ollama bge-m3 @ http://localhost:11434 — local, no token, no egress — 1024-dim
    └ bge-m3:latest · 634 MB · 100% GPU (fully resident — no CPU fallback) · 8192 ctx
```

634 MB, resident เต็ม 100% บน GPU — ไม่มี CPU fallback แปลว่าถ้า Metal ไม่พร้อม มันจะช้าเห็นได้ชัด ไม่ใช่ค่อย ๆ ตกลง

### สาม backend, ลำดับ auto-detect

ระบบไม่ผูกกับ backend เดียว — auto-detect ไล่ตามลำดับนี้: **ollama** (local, GPU, ไม่มี token ไม่มี egress) ก่อน ถ้าไม่เจอค่อยลอง **Cloudflare worker บนพอร์ต 18787** แล้วค่อยตกไปที่ **Cloudflare REST** (ต้องมี `CF_ACCOUNT_ID` + `CF_API_TOKEN`) บังคับตัวใดตัวหนึ่งได้ด้วย `CITATION_EMBED=ollama|worker|cf-rest` เวลา debug ว่า path ไหนถูกเรียกจริง

### batch ละ 16 — เหตุผลจากของจริง ไม่ใช่จากทฤษฎี

`CF_EMBED_BATCH` กำหนด batch size ไว้ที่ 16 ตัวเลขนี้ไม่ได้เดา — request เดียวก้อนใหญ่ (ยิงทั้ง 62 papers บวก vault notes รวดเดียว) เคยกินเวลาไป **500 วินาที** พอตัดเป็น batch ละ 16 เวลาลงมาอยู่ในระดับที่ใช้งานได้จริง batch เล็กแลกกับ overhead ของ HTTP round-trip ที่มากขึ้น แต่ predictable กว่าเยอะ

### store: ไฟล์ธรรมดาสามไฟล์ ไม่มี database

ที่เก็บ vector ทั้งหมดคือไฟล์ดิบสามไฟล์ ไม่มี database เข้ามาเกี่ยวข้องเลย:

```
.citation/store/
├── vectors.f32     # N × 1024 Float32, เขียนดิบเป็น binary
├── meta.jsonl      # หนึ่งบรรทัดต่อหนึ่ง entry (paper หรือ note)
└── manifest.json   # model id, count, dimension
```

search คือ brute-force cosine similarity เขียนด้วย TypeScript ล้วน ๆ ไม่มี index พิเศษ ไม่มี approximate-nearest-neighbor — วัดผลจริงคือ **74 rows ใน ~0.2 วินาที รวมเวลา embed query เข้าไปด้วย** ที่ n ระดับร้อย brute-force ยังเร็วกว่า setup ANN index เยอะ ลบ directory นี้ทิ้งแล้ว re-index ใหม่ได้เสมอ เพราะมันคือ derived data ล้วน ๆ — ไม่ใช่ source of truth

### manifest.json บันทึก model id ไว้ทำไม

เพราะ vector จากคนละโมเดลเทียบกันไม่ได้ — cosine similarity ระหว่าง vector ที่มาจาก bge-m3 กับ vector ที่มาจากโมเดลอื่นไม่มีความหมายอะไรเลย ตัวเลขออกมาได้ แต่มันคือขยะ `manifest.json` เก็บ model id ไว้เป็น guard: สลับโมเดลเมื่อไหร่ ต้อง re-index ทั้งหมดใหม่ ไม่มีทางผสม vector ต่างรุ่นในสโตร์เดียวกัน

### `--vault` — รวม papers กับ notes ไว้ในดัชนีเดียว

`index --vault` ไม่ได้ embed แค่การ์ด paper — มัน embed `ψ/memory/{learnings,retrospectives,resonance}` และ `ψ/writing/research` ด้วย ติด tag `kind: note` ผลคือ search หนึ่งครั้งครอบทั้ง literature และความคิดของ oracle เอง ผลลัพธ์จริงหน้าตาแบบนี้:

```
[0.7913] 📄 paper \cite{mahajan2025} (low-cost-sensor-calibration) Mahajan & Helbing (2025)
[0.8702] 📝 note (ψ/writing/research) Environmental prediction models for PM2.5
```

สองบรรทัด สอง kind ต่างกัน แต่อยู่ใน ranked list เดียวกัน — นี่คือจุดที่ corpus กับ thinking ของ oracle มาบรรจบกันจริง ไม่ใช่แค่คำโฆษณา

### layout สำหรับกราฟ: t-SNE, PCA-init, lr=15

การจัดตำแหน่งจุดบนกราฟ 2D ใช้ t-SNE โดย **init ด้วย PCA** เพื่อให้ deterministic — รันกี่ครั้งเลย์เอาต์ก็ได้ตำแหน่งเดิม ไม่สุ่มใหม่ทุกครั้ง learning rate ตั้งไว้ที่ **15** ตัวเลขนี้ก็มาจากความล้มเหลวจริง: เคยลอง lr=200 แล้วจุดทั้งหมด — 56 papers — ยุบรวมกันเป็นกลุ่มเดียวที่มุมเดียวของกราฟ ไร้ความหมาย lr=15 คือค่าที่ใช้ได้จริงสำหรับ n ขนาดเล็กแบบนี้

### ความซื่อสัตย์เรื่อง interpretability

bge-m3 ไม่ expose keyword ใด ๆ ออกมาให้ดูเลย — มันให้แค่ vector 1024 มิติ ถามว่า "ทำไมสอง paper นี้ถึงอยู่ใกล้กันบนกราฟ" ตอบตรง ๆ จาก model ไม่ได้ สิ่งที่ระบบทำคือคำนวณ **IDF-weighted term overlap** แล้วโชว์ใน UI เป็น label ว่า **"EVIDENCE FOR" การจับคู่แบบ semantic ไม่ใช่ "CAUSE" ของมัน** — คำที่ overlap กันคือหลักฐานสนับสนุนที่มนุษย์อ่านได้ ไม่ใช่กลไกที่ทำให้ vector ทั้งสองมาอยู่ใกล้กันจริง ๆ การแยกสองคำนี้ให้ชัดคือสิ่งที่กันไม่ให้ใครเข้าใจผิดว่า embedding model "เห็น" คำเหมือนที่มนุษย์เห็น
