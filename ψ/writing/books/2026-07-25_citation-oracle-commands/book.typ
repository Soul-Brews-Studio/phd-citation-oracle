// ===== คู่มือ Citation Oracle ฉบับสมบูรณ์ — typst styling =====
//   cat book.typ body.typ > full.typ
//   typst compile --font-path fonts full.typ out.pdf
//
// Two hard requirements, both learned the hard way (see the skill's warning):
//   1. typst >= 0.15.1 — 0.14.x mis-stacks Thai tone marks. This built on 0.15.1.
//   2. The font MUST be pinned here, because `pandoc -t typst` emits no
//      `#set text(font:)` at all. Without this line typst falls back to a default
//      with no Thai coverage and silently drops or mis-stacks marks.
// Laksaman is vendored into ./fonts so the build does not depend on ~/Library/Fonts.

#set text(font: ("Laksaman", "Norasi"), size: 11pt, lang: "th")
#set page(paper: "a4", margin: (top: 2.1cm, bottom: 2.1cm, left: 2.4cm, right: 2.4cm))
#set heading(numbering: none)
// justify: false on purpose — typst justifies by stretching whitespace, and Thai
// words are joined with zero-width spaces that cannot stretch. Justified Thai
// gets rivers. Ragged-right is the correct choice, not a compromise.
#set par(leading: 1.34em, justify: false, first-line-indent: 0em)
#set block(spacing: 1.35em)

// ── cover ──
#set page(margin: 2.2cm)
#line(length: 100%, stroke: 3pt + rgb("#c0392b"))
#v(5em)
#align(center, text(size: 44pt)[🌌])
#v(1.5em)
#align(center, text(size: 30pt, weight: "bold", fill: rgb("#1a1a2e"))[
  คู่มือคำสั่ง Citation Oracle
])
#v(1.2em)
#align(center, text(size: 13pt, fill: luma(90))[
  คำสั่งล้วน ไม่มีอารัมภบท \
  เปลี่ยนกองเอกสารอ้างอิงให้เป็น `.bib` ที่เชื่อถือได้
])
#v(2.5em)
#align(center, text(size: 11.5pt, weight: "bold", fill: rgb("#c0392b"))[
  Citation Oracle ★ (AI, ไม่ใช่คน) — จาก ณัฐ วีระวรรณ์
])
#v(0.6em)
#align(center, text(size: 9.5pt, fill: luma(140))[
  25 กรกฎาคม 2026 · 15 บท · 125 คำสั่ง · ทุกคำสั่งรันจริงแล้ว \
  ฉบับยาว 170 หน้า มีแยกเล่มสำหรับคนอยากอ่านคำอธิบายละเอียด
])
#v(1fr)
#align(center, text(size: 9pt, fill: luma(150))[
  github.com/Soul-Brews-Studio/phd-citation-oracle
])
#v(1em)
#line(length: 100%, stroke: 3pt + rgb("#c0392b"))

// ── content pages ──
// Reset fill + margin after the cover, or they leak into the body.
#set page(
  paper: "a4",
  margin: (top: 2.1cm, bottom: 2.1cm, left: 2.4cm, right: 2.4cm),
  fill: white,
  numbering: "1",
)
#counter(page).update(1)

#outline(title: "สารบัญ", depth: 1)
#pagebreak()

// Chapter headings start a new page
#show heading.where(level: 1): it => {
  pagebreak(weak: true)
  set text(size: 18pt, weight: "bold", fill: rgb("#1a1a2e"))
  v(0.6em)
  block(it)
  v(0.3em)
  line(length: 100%, stroke: 1.5pt + rgb("#c0392b"))
  v(0.7em)
}

#show heading.where(level: 2): it => {
  set text(size: 13pt, weight: "bold", fill: rgb("#2c3e50"))
  v(0.7em); block(it); v(0.2em)
}

#show heading.where(level: 3): it => {
  set text(size: 12pt, weight: "bold", fill: rgb("#34495e"))
  v(0.55em); block(it); v(0.15em)
}

#show raw.where(block: true): it => {
  set text(font: "Fira Code", size: 8pt)
  set par(leading: 0.66em)
  block(fill: rgb("#f6f8fa"), stroke: 0.5pt + luma(200),
    inset: 7pt, radius: 4pt, width: 100%, it)
}

#show raw.where(block: false): it => {
  box(fill: rgb("#f0f0f0"), inset: (x: 3pt, y: 1.5pt), radius: 2pt,
    text(font: "Fira Code", size: 9pt, fill: rgb("#36454f"), it))
}

#show strong: it => text(weight: "bold", fill: rgb("#1a1a2e"), it)

#show quote.where(block: true): it => {
  block(fill: rgb("#f0f4f8"), stroke: (left: 3pt + rgb("#3498db")),
    inset: (left: 16pt, right: 12pt, top: 10pt, bottom: 10pt),
    radius: (right: 4pt), it)
}

#set table(
  stroke: 0.5pt + luma(180),
  fill: (_, row) => if row == 0 { rgb("#2c3e50") }
    else if calc.odd(row) { rgb("#f8f9fa") } else { white },
)
// Left-align body cells: pandoc-typst centres by default, which jumbles wrapped text.
#show table.cell: it => {
  set text(size: 9.5pt)
  if it.y == 0 { align(center, text(fill: white, weight: "bold", it)) } else { align(left, it) }
}
