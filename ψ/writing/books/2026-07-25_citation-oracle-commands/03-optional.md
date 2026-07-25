# บทที่ 3: เตรียมลงอุปกรณ์เพิ่มเติม — ของเสริมที่ลงเมื่อจำเป็น

สี่ตัวนี้ไม่มีก็รันได้ปกติ มีก็ได้เพิ่มความสะดวก ตารางเดียวสรุปครบ
แล้วต่อด้วยคำสั่งติดตั้งจริงทีละตัว

## ของเสริมสี่ตัว

| ตัว | ติดตั้งยังไง | ได้อะไรเพิ่ม | ถ้าไม่มีจะเป็นยังไง |
|---|---|---|---|
| `sharp` | `bun install` (อยู่ใน `optionalDependencies` แล้ว) | `graph` แปลง SVG → PNG เพิ่มอีกไฟล์ | ได้ SVG อย่างเดียว (คมกว่าด้วยซ้ำ) |
| `maw` | ไม่ต้องลงแยก — เป็นส่วนของ oracle ecosystem | เรียกผ่าน `maw citation <verb>` | ใช้ `./bin/citation <verb>` แทนได้ทุกอัน |
| `wrangler` | `npm install -g wrangler && wrangler login` | รัน cloud embedder สำรอง เวลาไม่มี GPU local | ใช้ `ollama` local ต่อไป (default อยู่แล้ว) |
| `bibtex` | ลง TeX Live เช่น `brew install --cask mactex` | ตรวจว่า `.bib` compile ผ่านจริงก่อน push | ได้ `.bib` ปกติ ไปให้ Overleaf ตรวจแทนได้ |

ไม่มีตัวไหนอยู่ใน `dependencies` เลย — `sharp` เป็น npm package จริง
เลยขึ้นทะเบียนใน `optionalDependencies` ส่วน `maw` `wrangler`
`bibtex` เป็นโปรแกรมนอกระบบ เรียกผ่าน path หรือ `import()` dynamic

## `sharp` — แปลง SVG เป็น PNG เท่านั้น

```bash
# sharp อยู่ใน optionalDependencies แล้ว - ลงพร้อม
# bun install ปกติ ไม่ต้องสั่งแยก
bun install

# ลงแยกเจาะจงก็ได้ (native module - build ไม่ผ่าน
# บนเครื่องที่ไม่มี compiler ก็แค่ข้าม ไม่พังทั้งก้อน)
bun add sharp
```

`graph` วาด SVG ก่อนเสมอ ไม่มีเงื่อนไข มี `sharp` ก็แปลงเป็น PNG
เพิ่มให้อีกไฟล์ สำหรับคนที่อยากแปะลง Google Docs หรือ PowerPoint
ที่ SVG ใช้ไม่สะดวก โค้ดจริง (`ψ/lab/citation/src/index.ts:1551`):

```typescript
await Bun.write(svgPath, svg);   // SVG เขียนไปแล้วเสมอ

try {
  const { default: sharp } = await import("sharp");
  await sharp(Buffer.from(svg)).png().toFile(outPath);
  pngNote = `\n✦ png → ${outPath}`;
} catch {
  pngNote = `\n  (png skipped — 'sharp' not installed;` +
    ` the SVG above is the figure)`;
}
```

ไม่มี `sharp` ไม่มี error ไม่มีอะไรค้าง — แค่ `pngNote` เปลี่ยนเป็น
ข้อความ skip SVG เป็น vector ซูมเท่าไหร่ก็คมเท่าเดิม PNG ที่
`sharp` render ออกมาคือ raster ตรึงความละเอียดตาม pixel ตอนนั้น
`package.json` ประกาศความตั้งใจนี้ไว้ตรงๆ:

```json
"dependencies": {},
"optionalDependencies": {
  "sharp": "^0.33.5"
}
```

`optionalDependencies` คือ field มาตรฐานของ npm/bun — "ลองลงให้
ถ้าลงไม่ผ่าน (เช่นเครื่องไม่มี compiler ของ native module) ก็ข้าม
ไป ไม่ทำให้ install ทั้งก้อนพัง" ต่างจาก `dependencies` ตรงที่ตัว
นั้นพังปุ๊บคือ `bun install` ทั้งคำสั่งพังตาม

## `maw` — ประตูที่สอง ไม่ใช่ทางเดียว

สองทางเรียกคำสั่งเดียวกัน handler ตัวเดียวกันเป๊ะ ไม่มี dispatch
สองชุดให้ต้องดูแลคู่กัน:

```bash
./bin/citation status      # ต้องมีแค่ bun
maw citation status        # เหมือนกันทุกอย่าง สำหรับคนที่มี maw
```

ที่ต้องมีสองทาง เพราะ `maw` เป็น federation engine ของ oracle
family ให้ oracle คุยข้าม repo ได้ (`maw hey`, `maw locate`) ใครอยู่
ในระบบ oracle แล้วใช้ `maw citation` ต่อเนื่องได้เลย คนโคลน repo
มาอ่านเฉยๆ ไม่มี oracle ecosystem ก็ใช้ `./bin/citation` เต็มรูป
แบบ ไม่ต้องหา `maw` มาลงก่อน

ต่างกันจริงจุดเดียว — วิธีหา repo root ตอนเริ่มทำงาน:

```text
CITATION_ROOT (ตั้งเองผ่าน env)
  → MAW_HOME (ถ้ามี maw)
  → ไล่ขึ้นจาก SCRIPT หา CLAUDE.md + ψ/
  → ไล่ขึ้นจาก cwd หา CLAUDE.md + ψ/
  → git rev-parse --show-toplevel
  → cwd (fallback สุดท้าย)
```

`./bin/citation` ไล่จาก SCRIPT ก่อน เรียกจาก `/tmp` ก็ยังหา repo
เจอ (commit `051014b`) `maw` ใช้ `MAW_HOME` เป็นหลัก เพราะมันมัก
`cd` เข้า plugin directory เองก่อนเรียก cwd ใช้ไม่ได้แล้วตอนนั้น

root ผิด = ความล้มเหลวเงียบที่สุด ไม่ error ไม่ crash แค่รายงาน
"0 paper cards" เหมือนข้อมูลหาย เพราะงั้น `status` พิมพ์บอกเสมอว่า
ใช้กฎไหนหา root มา — เห็นทันทีถ้ามันเดาผิด

## `wrangler` — cloud embedder สำรอง เวลาไม่มี GPU local

```bash
# ติดตั้งครั้งเดียว ใช้ login เดิม ไม่ต้องขอ token ใหม่
npm install -g wrangler
wrangler login
```

```bash
# รัน worker local ที่พอร์ต 18787
cd ~/.maw/plugins/cf-embed/worker
wrangler dev --port 18787
```

`search`/`index` ลอง backend เรียงลำดับ ไม่ต้องตั้งอะไรเอง:

```text
ollama    → local, ใช้ GPU, ไม่มี token ไม่มี network
            (default เมื่อรันอยู่)
worker    → wrangler dev --port 18787
            (ใช้ wrangler login เดิม ไม่ต้องขอ token ใหม่)
cf-rest   → Cloudflare REST + CF_ACCOUNT_ID + CF_API_TOKEN
```

เครื่อง m5 (Apple M5 Max) มี GPU ให้ `ollama` ผ่าน Metal อยู่แล้ว
backend แรกสุดถูกเลือกเสมอ ไม่เคยต้องแตะ `wrangler` จริง ลด
`ollama list` ให้ไม่มี `bge-m3` เมื่อไหร่ ก็ไหลไปหา `wrangler` เอง
อัตโนมัติ ไม่ต้องแก้โค้ด

ไม่มี `wrangler` เลย — ถ้า `ollama` ยังรันอยู่ไม่มีผลอะไร ถ้าไม่มี
ทั้งคู่ มันพยายามต่อ `http://localhost:18787/embed` แล้วเจอ error
ที่บอกทางแก้ตรงๆ:

```text
Local embed worker unreachable at http://localhost:18787
— reuse the shared one:
cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787
```

## `bibtex` — ของที่ไม่ได้ "รัน" แต่ "ตรวจ"

ไม่ถูกโค้ดเรียกเลยสักบรรทัด ใช้ **หลังจาก** `citation bib` สร้าง
`.bib` เสร็จแล้ว เพื่อตอบว่าไฟล์ใช้กับ `\cite{}` จริงได้ไหม:

```bash
# macOS - ลง TeX Live แบบเต็ม หรือแบบเบา เลือกอย่างใดอย่างหนึ่ง
brew install --cask mactex        # ~4GB ครบทุกอย่าง
brew install --cask basictex      # เบากว่า อาจต้อง tlmgr เพิ่ม

# ตรวจว่า .bib compile ผ่านจริง ไม่ใช่แค่เปิดอ่านด้วยตา
bibtex path/to/references.bib
```

`.bib` เป็นข้อความธรรมดา เขียนผิด field ก็ยังเปิดอ่านได้ปกติ ความ
ผิดโผล่ตอน compile LaTeX เท่านั้น ผลจริงบนเครื่องนี้ ผ่าน TeX Live
2026: 62 entry ใน `.bib` แปลงเป็น 62 `\bibitem` ครบ warning ที่
`bibtex` รายงานกลับมา — ศูนย์

ไม่มี TeX Live — `.bib` ยังใช้งานได้ปกติ เปิดด้วย Overleaf หรือ
editor ที่รองรับ BibTeX เอง ระบบนั้น compile และรายงาน error ให้
เองตอนอัปโหลด แค่ไม่มีการตรวจ local ก่อน push เท่านั้น

## หลักการ: optional dependency ต้อง optional จริง

สามตัวแรก (`sharp` `wrangler` และ backend อื่นที่เรียกผ่าน
`import()`) ใช้รูปแบบเดียวกัน — dynamic `import()` ห่อด้วย
`try`/`catch`:

```typescript
let note: string;
try {
  const mod = await import("some-optional-package");
  // ใช้ mod ทำงานที่ต้องพึ่งมัน
  note = "ทำสำเร็จด้วย some-optional-package";
} catch {
  // import ไม่เจอ (ไม่ได้ลง) หรือ native module
  // build ไม่ผ่านบนเครื่องนี้ ก็ตกลงมาที่นี่เหมือนกัน
  note = "ข้ามขั้นนี้ไป — ตัวหลักยังทำงานต่อได้ปกติ";
}
```

| จุดสำคัญ | เหตุผล |
|---|---|
| `import()` dynamic ไม่ใช่ static | static import resolve ตอน parse ไฟล์ — ไม่มี package ก็พังทั้งตัวตั้งแต่ยังไม่ทันรัน (`sharp` เคยเป็นแบบนี้มาก่อน จนต้องถอดออกจาก `dependencies`, commit `5475615`) |
| งานหลักเกิด **ก่อน** เข้า `try` เสมอ | optional dependency ต้องเป็นของแถมที่เพิ่มทีหลังงานจริงเสร็จ ไม่ใช่ตัวปิดท้ายที่ทั้งระบบรอ |
| ข้อความใน `catch` ต้องบอกชัดว่า "ข้ามไปแล้ว" | ไม่กลืน error เงียบๆ คนใช้ต้องเห็นว่ามีขั้นตอนถูกข้าม ไม่ใช่เข้าใจผิดว่าเสร็จสมบูรณ์แล้ว |

> **เคส NUL byte** — กำลังจะลบ `sharp` ออกจาก `package.json` เพราะ
> คิดว่าไม่ได้ใช้ รัน `rg sharp` เช็คก่อน ได้แค่ comment ฟอนต์กับ
> `binary file matches` เพราะไฟล์มี byte `\u0000` จริงอยู่กลาง
> string literal (ไม่ใช่ escape) — `rg` เจอ NUL เลยมองไฟล์เป็น
> binary หยุดรายงาน match เงียบๆ จุดเรียกใช้จริงบรรทัด 1551 เลยไม่
> โผล่มา เกือบลบของที่ยังใช้อยู่จริง ทางแก้ — เขียน `\u0000` เป็น
> escape ในซอร์สเสมอ ไม่ใช่ byte จริง (commit `4204da2`)

เจอ **"binary file matches"** จาก `rg`/`grep` เมื่อไหร่ อย่าอ่านว่า
"ไม่มีอะไรตรงนั้น" — มันแปลว่าเครื่องมือยอมแพ้กับไฟล์นี้แล้ว ไม่
แน่ใจว่าไฟล์เป็น text ล้วน เปิดอ่านตรงๆ หรือใช้ `rg -a` บังคับค้น
แบบ text ดีกว่าเชื่อผล negative ที่อาจเป็นแค่การยอมแพ้กลางทาง

ของเสริมสี่ตัวจบแล้ว บทที่ 4 พาไปเปิด `ψ/papers/` — การ์ด 62 ใบที่
เป็น source of truth ตัวจริงของ corpus ทั้งหมด
