---
pattern: "A teammate's negative claim ('X does not exist') is still a claim — verify it against that teammate's own artifacts before acting on it, especially when the search was thorough enough to sound conclusive"
date: 2026-07-25
source: "rrr: phd-citation-oracle"
concepts: [federation, verification, negative-results, archaeology, trust, digger]
---

# Verify a peer's negative claim against its own artifacts

## What happened

Nat wanted a literature-embedding visualisation he half-remembered — something better than a
TF-IDF map. I dispatched digger-oracle, which ran a genuinely rigorous dig: direct SQL against
a 245k-message Discord archive, a full guild sweep, reads of another oracle's session
transcripts. It reported:

> "No chart/image was ever generated from the MiniLM/bongbaeng pipeline — it's CLI-only, text
> output, no visualization step. There is nothing to recover from Discord because nothing was
> ever posted."

Its recommendation followed logically: someone should now *build* the chart from scratch.

**Both images already existed**, recovered weeks earlier and committed to **digger's own**
`ψ/artifacts/2026-06-12_.../`:

- `01_embedding-space.png` — titled *"Embedding Space — 12 satellite/PM2.5 papers
  (all-MiniLM-L6-v2 384d → PCA 2D)"*
- `02_semantic-search-results.png` — *"Vector-DB Semantic Search (Bun + transformers.js +
  sqlite)"*

Its own wiki page even had a correction section attributing that group to bongbaeng's
sqlite-TS/MiniLM pipeline. I found them by opening the artifacts directory its earlier report
had cited.

digger's response when shown: *"ผิดจริง — เปิดไฟล์เองแล้วเห็นชัดเลย ... ไม่ได้อ่าน wiki เดิม
ทั้งหน้าก่อนขุดใหม่"* — it hadn't re-read its own prior wiki before answering the new question.
It then patched the wiki with a self-correction section (`6ef115d`).

## Why the failure was invisible

- The negative was **methodologically impressive**: real queries, named tables, row counts. Rigour
  in the method reads as reliability in the conclusion.
- The question had **shifted** between digs ("the lost visualization" → "the *neural* one"), and
  the new framing didn't obviously connect to the old artifacts.
- Nobody re-reads their own notes when they're confident they remember them.

## Rules to carry forward

- **Check the artifacts a peer's own report cites before accepting a negative from it.** Costs
  one directory listing; here it prevented rebuilding something that already existed.
- **A negative claim needs the same scrutiny as a positive one.** "It doesn't exist" ends
  searches, so it should be the *more* scrutinised direction, not the less.
- **Beware method-rigour as a proxy for conclusion-correctness.** The queries were real; the
  conclusion still contradicted files on disk.
- **When you correct a peer, point at its own evidence.** Naming the exact paths and titles made
  the correction immediate and unembarrassing — it verified, agreed, and patched its wiki within
  minutes.
- **Ask what changed between the question then and the question now.** The re-dig missed the
  answer because it treated a reframed question as a new one.

Related: [[verify-in-the-users-environment]] — same session, the mirror-image failure where *I*
was the one reporting a conclusion my method hadn't actually established.
