---
name: paper-card
description: Import a paper into the vault as a markdown card, or export cards out to BibTeX/CSV/a comparison table. Handles messy input — a pasted APA/BibTeX reference, a DOI, a bare title, a Gemini/ChatGPT deep-research bibliography, or a whole list of them — and writes one card per paper with clean frontmatter (citekey, authors, year, journal, topic, doi) that `maw citation index` can pick up. Use this whenever someone says "add this paper", "import these references", "เพิ่ม paper", "ใส่ paper เข้า corpus", "make a .bib", "export the bibliography", "turn this bibliography into cards", pastes a citation or a DOI, or hands over research output containing a reference list. Do NOT use it to search or visualise the corpus (that's `maw citation search` / `graph`), and not for writing prose about the literature.
argument-hint: "import <input> | export --bib [path] | export --csv | dedupe | fix-authors"
---

# paper-card — get papers in, get bibliographies out

The corpus lives as one markdown card per paper (see `ψ/papers/README.md`). Cards are the
canonical store; the LanceDB index and any `.bib` are **derived**. So every import ends by
writing cards, and every export reads them — never the reverse.

## Before anything: read the format

Read `ψ/papers/README.md` (the field reference and the body-block shapes) and open one existing
card. Matching the existing shape exactly matters more than being clever, because
`readPaperCards()` in `ψ/lab/citation/src/index.ts` parses `**Key findings** —` /
`**Thesis relevance** —` and the `kind: paper` frontmatter key. A card that deviates silently
drops out of the index.

## Import

### Step 1 — figure out what you were handed

| Input | What to do |
|---|---|
| A full reference (APA/Vancouver/whatever) | Parse it directly — authors, year, title, journal, volume, pages |
| A BibTeX entry or `.bib` file | Parse the fields; keep the original key as `citekey` if it's sane, else regenerate |
| A DOI | Resolve it via `https://api.crossref.org/works/<doi>` and fill fields from the JSON |
| A bare title | Search Crossref by title (`https://api.crossref.org/works?query.bibliographic=<title>&rows=3`), show the top matches, confirm before writing |
| A deep-research report / bibliography | Extract every reference, then dedupe against the corpus **before** writing anything |
| A PDF | Read the first page for title/authors/DOI; if there's a DOI, prefer Crossref over your reading of the page |

Crossref is unauthenticated and returns clean structured metadata — prefer it over guessing.
When it disagrees with a pasted citation, trust Crossref and say you did.

### Step 2 — dedupe against what's already there

Never write a card without checking. The corpus already holds 56 papers, and a
deep-research bibliography will overlap heavily.

```bash
maw citation search "<paper title>" -k 5 --json     # semantic — catches near-duplicates
rg -l -i "<distinctive title words>" ψ/papers/       # lexical — catches exact ones
rg -i "<first author surname>" ψ/papers/*.md | head
```

Report overlaps as a table (new / already-have / uncertain) and let the human resolve the
uncertain ones. Silently adding a second card for a paper that's already in is worse than
asking, because the duplicate then shows up twice in the constellation and twice in the `.bib`.

### Step 3 — assign a citekey

`<first-author-surname-lowercase><year>`, plus `b`, `c`… on collision — e.g. `barkjohn2021`,
`amnuaylojaroen2023b`. The filename **is** the citekey **is** the `\cite{}` key; keep those three
identical or the bibliography breaks.

No authors available? Use `<journal-word><year>` and set `status: needs-authors` rather than
inventing names. Nine cards already sit in that state — they're honest placeholders, not bugs.

### Step 4 — pick a topic

One of the six in use: `low-cost-sensor-calibration` · `satellite-pm25-products` ·
`thailand-burning-season` · `health-policy` · `reference-monitoring-bam` ·
`multi-source-fusion-qa`. These colour the constellation, so a new topic value fragments the
palette — propose one explicitly instead of quietly introducing it.

### Step 5 — write the card, then index

Write `ψ/papers/<citekey>.md` in the existing shape. `**Key findings**` should carry real
numbers (R², RMSE, %) because that text is what gets embedded — a vague summary makes the paper
unfindable. `**Thesis relevance**` is what makes search useful; write it from the corpus's point
of view, and if you genuinely don't know, say `_not yet assessed_` rather than padding.

```bash
maw citation index          # or --vault to refresh notes too
maw citation search "<something distinctive from the new paper>" -k 3
```

Confirm the paper comes back before declaring success. Then report: cards written, duplicates
skipped, anything left at `needs-authors` or `doi: ""`.

## Export

### BibTeX

Read every card, emit `@article{...}` (or the right type) using `citekey` as the key. Skip
nothing silently — if a card lacks authors or a DOI, still emit the entry and list it in a
"needs attention" summary afterwards, because a bibliography with a hole you know about beats
one with a hole you don't.

```
@article{mahajan2025,
  author  = {Mahajan, S. and Helbing, D.},
  title   = {Dynamic calibration of low-cost PM2.5 sensors using trust-based consensus mechanisms},
  journal = {npj Climate and Atmospheric Science},
  year    = {2025},
  volume  = {8},
  pages   = {257},
  doi     = {10.1038/s41612-025-01145-2},
}
```

Details worth getting right: `{}` around anything with capitals you want preserved (`{PM2.5}`,
`{GEMS}`) since BibTeX lowercases titles in many styles; `and` between authors, never `&`; omit
empty fields rather than emitting `doi = {}`. Write to `artifacts/references.bib` by default and
say how many entries and how many are incomplete.

### Other shapes

- **CSV / comparison table** — citekey, authors, year, journal, quartile, topic, and whichever
  numbers the human asked about. Good for a thesis appendix.
- **Markdown table** — same, inline in a chat or a chapter draft.
- **Filtered subsets** — "just the satellite ones", "only Q1", "only papers I've annotated"
  (`rg -l '## Notes' -A2 ψ/papers/ | ...`). Filter on frontmatter, not on guesswork.

## Maintenance verbs

- **`dedupe`** — cross-check every card against every other by title similarity, report suspected
  duplicates, never delete without confirmation (Nothing is Deleted).
- **`fix-authors`** — take the `needs-authors` cards, resolve each via Crossref by title, show
  the proposed authors side by side with the paper title, and apply only what's confirmed.

## Honesty rules

These matter more here than anywhere, because a bibliography is a set of claims about what
exists:

- **Never invent a DOI, an author list, a volume or a page range.** Leave the field empty and set
  `status:` accordingly. A missing field is a task; a fabricated one is a defect that propagates
  into a thesis.
- **Say where each field came from** when you resolved it — Crossref, the pasted citation, or
  the PDF. If two sources disagree, show both.
- **Don't upgrade a guess into a fact** by writing it into frontmatter. Notes are where
  uncertainty lives: `## Notes` survives regeneration, frontmatter is machine-read.
- **Preserve `## Notes` and `doi:`** on any card you rewrite — the CLI's `cards` verb does this,
  and hand edits must too.
