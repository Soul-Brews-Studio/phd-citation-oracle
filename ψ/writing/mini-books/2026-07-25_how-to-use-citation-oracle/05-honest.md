## §5 — บทเรียน: ที่ผิดพลาด และที่เราผิดเอง

**ข้อมูลที่ยังไม่เอาไปเช็คกับของจริง ไม่นับว่าถูก** — ทุกจุดในบทนี้โผล่มาก็ต่อเมื่อมีอะไรจากภายนอกมายืนยัน ไม่ใช่ตอนที่เรา (ผู้ดูแล corpus) มั่นใจ

### (A) 18 จุดผิดใน 14 cards — เจอเพราะเอาไปชน Crossref

ก่อนรัน `citation doi`, ทุก card คือ "เชื่อไปตามที่บันทึกไว้" พอชนกับ Crossref จริง `artifacts/citation-audit.md` นับได้ 18 จุดผิดใน 14 cards — highlight ที่หนักสุด:

**she2019 — ชื่อ paper ถูกกุขึ้นทั้งชื่อ.** Card เดิมเขียนว่า *"Validation of GeoNEX Himawari-8 MAIAC Aerosol Optical Depth"* — ของจริงคือ *"Evaluation of the Multi-Angle Implementation of Atmospheric Correction (MAIAC) Aerosol Algorithm for Himawari-8 Data"* DOI (`10.3390/rs11232771`) ถูกมาตลอด แต่ไม่มีใครเอาชื่อไปเทียบกับ DOI เลยจนถึงตอนนี้ — ต้นตอมาจาก AI research report จากภายนอก ที่มั่นใจพอที่จะเขียนชื่อใหม่ทับของจริง

**taneepanichskuld2025 — เครดิตคนผิดเป็น first author.** Card ให้เครดิต "Taneepanichskuld" (สะกดผิดจาก Taneepanichskul ด้วย) เป็น first author — คนนี้คือ **last author** ตัวจริงคือ Buya, S. ผิดสองชั้นซ้อนกัน: ทั้งลำดับคนเขียนสลับ ทั้งตัวสะกดชื่อเอง

**Phantom page numbers จากหาง DOI — 4 cards.** yu2023 บันทึกไว้ว่า p363 — เลข 363 มาจากหาง DOI `10.1038/s41612-023-00363-w` ตรง ๆ ทั้งที่ article number จริงคือ 41 อีก 3 จุดแบบเดียวกัน: 833→326, 837→293, 2069→18573 — pattern เดียวกันหมด: เอาหาง DOI มาแปลว่าเลขหน้า

รวมทั้งหมด: 7 cards ผิด first author, author list ไม่ครบ 24 cards (21 จุดถูกตัดด้วย "et al." อีก 3 จุดหายเงียบไม่มีเครื่องหมายเลย — she2019 หาย author คนที่ห้า Shi, Y. ไปแบบไม่บอกกล่าว), thongsame2024 ผิด journal, buya2025 เอา first page (41) ไปใส่ในช่อง volume (จริงคือ 36)

### สิ่งที่เราทำพลาดเอง — ไม่ใช่แค่ข้อมูลเก่าที่ผิด

**(B) นับ error ผิดเองในข้อความ commit.** Commit `c01b2f5` เขียนบรรทัดสรุปว่า "11 citation errors" — แต่ตัวเลขที่ breakdown ด้านล่างรวมกันมากกว่านั้น เรานับเอง พลาดเอง วิธีแก้ไม่ใช่ไปแก้ commit เดิม แต่ generate `artifacts/citation-audit.md` จาก git ให้เลขมัน derive ออกมาเอง ไม่ใช่ assert เอาเอง — commit `e3c7f74` **บทเรียน: ตัวเลขที่ assert เองต้องเปลี่ยนเป็นตัวเลขที่ derive ได้**

**(D) บอก Nat ว่า "fix แล้ว" ทั้งที่เทสผ่าน pipe ไม่ผ่าน TTY จริง.** `serve` เดิมพิมพ์ URL แล้วจบโปรแกรมทันที เพราะ `import.meta.main` exit guard ยกเว้นแค่ "visualize" ไม่ได้ยกเว้น "serve" — `process.exit(0)` รันก่อนที่ `Bun.serve()` จะได้ hold event loop ซ้ำร้ายกว่านั้น `maw` buffer stdout ของ plugin ไว้จนกว่า process จะจบ เลยไม่มีอะไรถูกพิมพ์ออกมาให้เห็นด้วยซ้ำ เราเทสผ่าน pipe ที่ redirect ไว้ — ไม่เคยแตะ TTY จริงเลย แล้วบอก Nat ว่า "fix แล้ว ลองรันอีกที" Nat เสียรอบทดสอบไปสองรอบเพราะคำยืนยันของเรา ทางแก้จริง: export `LONG_RUNNING` set ใช้ร่วมกับ `bin/citation` แล้วให้ `announce()` เขียนลง `/dev/tty` ตรง ๆ **บทเรียน: pipe ไม่ใช่ TTY — คำว่า "fix แล้ว" ต้องพิสูจน์จาก terminal จริง ไม่ใช่จาก exit code 0**

**(C) หน้าเปล่าจาก token replace ที่ไม่ global.** `page.html` มี `{{DATA_JSON}}` สองที่ — ที่จริงในตัว `<script>` และที่พูดถึงมันในคอมเมนต์หัวไฟล์ (documented the tokens) การแทนที่แบบไม่ global จับ match แรกในคอมเมนต์ ตัว `<script>` เลยไม่เคยได้ข้อมูลจริง หน้าจึงเปล่าแบบเงียบ ๆ ไม่มี error โผล่ ทางแก้: replace แบบ global บวก fail-loud check ว่าไม่มี `{{` เหลือหลังแทนที่

**(E) t-SNE learning rate 200 ยุบทุกจุดเป็นก้อนเดียว.** สำหรับ n เล็ก lr=200 (ค่า default ทั่วไป) ทำให้ 56 จุดยุบไปมุมเดียวกันหมด ต้องลดเหลือ lr=15 ถึงจะกระจายเห็นโครงสร้างจริง

**เส้นเดียวที่ร้อยทุกจุดนี้เข้าด้วยกัน: ไม่มีจุดไหนเห็นได้ด้วยตาเปล่าจากในระบบเอง** — ต้องเอาไปชนกับ Crossref (A), เอาไปชนกับ git log (B), เอาไปชนกับ TTY จริง (D), เอาไปชนกับ bibtex (.bbl "warning$ -- 0" คือหลักฐานว่าผ่านจริง) — ทุกครั้งที่ "เชื่อเอง" คือทุกครั้งที่มีจุดผิดซ่อนอยู่
